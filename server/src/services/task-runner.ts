import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import type { CrawlTask, CandidateArticle, RawArticle, SSEEvent, CrawlLogEntry } from '../types.js';
import { getSettings } from '../config/settings.js';
import { getEnabledCrawlers } from '../crawlers/registry.js';
import { sensitiveFilter, lengthFilter, junkTitleFilter } from './filter.js';
import { scoreArticle } from './scorer.js';
import { classifyArticle } from './classifier.js';
import { saveTask, getHistoryUrls, getHistoryTitles, isTitleDuplicate } from './storage.js';
import { extractImagesFromContent } from '../crawlers/base.js';
import { rewriteBatch } from './rewriter.js';

class TaskRunner extends EventEmitter {
  private currentTask: CrawlTask | null = null;
  private stopRequested = false;

  get running(): boolean {
    return this.currentTask?.status === 'running';
  }

  get currentTaskId(): string | null {
    return this.currentTask?.id ?? null;
  }

  private taskTopicKeywords: string[] | undefined;
  private taskExtraSources: string[] | undefined;

  async start(requestedCount: number, topicKeywords?: string[], extraSources?: string[]): Promise<CrawlTask> {
    if (this.running) {
      throw new Error('A task is already running');
    }

    this.taskTopicKeywords = topicKeywords;
    this.taskExtraSources = extraSources;

    const task: CrawlTask = {
      id: nanoid(12),
      status: 'running',
      requestedCount,
      fetchedCount: 0,
      filteredCount: 0,
      failedCount: 0,
      candidates: [],
      startedAt: new Date().toISOString(),
      logs: [],
    };

    this.currentTask = task;
    this.stopRequested = false;
    saveTask(task);

    const topicInfo = topicKeywords ? ` [topic: ${topicKeywords.slice(0, 3).join(', ')}...]` : '';
    this.addLog('info', `Task ${task.id} started — requesting ${requestedCount} articles${topicInfo}`);

    this.runPipeline(task).catch((err) => {
      task.status = 'failed';
      task.endedAt = new Date().toISOString();
      this.addLog('error', `Task failed: ${String(err)}`);
      saveTask(task);
      this.emitSSE({ type: 'error', data: { message: String(err) } });
    });

    return task;
  }

  stop(): void {
    if (!this.running) return;
    this.stopRequested = true;
    this.addLog('info', 'Stop requested — will stop after current item');
  }

  getTask(): CrawlTask | null {
    return this.currentTask;
  }

  private async runPipeline(task: CrawlTask): Promise<void> {
    const baseSettings = getSettings();
    const settings = this.taskTopicKeywords
      ? { ...baseSettings, topicKeywords: this.taskTopicKeywords }
      : baseSettings;
    const sourceIds = this.taskExtraSources && this.taskExtraSources.length > 0
      ? this.taskExtraSources
      : settings.enabledSources;
    const crawlers = getEnabledCrawlers(sourceIds);

    if (crawlers.length === 0) {
      throw new Error('No enabled news sources');
    }

    const historyUrls = getHistoryUrls(settings.dedupWindowHours);
    const historyTitles = getHistoryTitles(settings.dedupWindowHours);
    const batchTitles = new Set<string>();
    this.addLog('info', `Dedup: ${historyUrls.size} URLs + ${historyTitles.size} titles from last ${settings.dedupWindowHours}h`);

    const perSource = Math.ceil(task.requestedCount * 2 / crawlers.length);

    const queue = new PQueue({ concurrency: 1, interval: settings.requestIntervalMs, intervalCap: 1 });
    const allRaw: RawArticle[] = [];

    for (const crawler of crawlers) {
      if (this.stopRequested) break;

      this.addLog('info', `Fetching from ${crawler.name}...`);
      this.emitSSE({
        type: 'progress',
        data: { fetched: task.fetchedCount, filtered: task.filteredCount, failed: task.failedCount, total: task.requestedCount, phase: 'crawling', current: crawler.name },
      });

      try {
        const articles = await queue.add(() => crawler.fetchList(perSource));
        if (articles) {
          allRaw.push(...articles);
          this.addLog('info', `Got ${articles.length} articles from ${crawler.name}`);
        }
      } catch (err) {
        task.failedCount++;
        this.addLog('error', `Failed to fetch from ${crawler.name}: ${String(err)}`);
      }
    }

    this.addLog('info', `Processing ${allRaw.length} raw articles...`);
    this.emitSSE({
      type: 'progress',
      data: { fetched: task.fetchedCount, filtered: task.filteredCount, failed: task.failedCount, total: task.requestedCount, phase: 'processing' },
    });

    for (const raw of allRaw) {
      if (this.stopRequested) break;

      if (historyUrls.has(raw.url)) {
        this.addLog('info', `Skipped (URL duplicate): ${raw.title}`);
        continue;
      }

      if (isTitleDuplicate(raw.title, historyTitles, batchTitles)) {
        this.addLog('info', `Skipped (title duplicate): ${raw.title}`);
        continue;
      }

      if (!lengthFilter(raw)) {
        task.filteredCount++;
        this.addLog('info', `Filtered (too short): ${raw.title} (${raw.content.length} chars)`);
        continue;
      }

      if (!junkTitleFilter(raw)) {
        task.filteredCount++;
        this.addLog('info', `Filtered (junk title): ${raw.title}`);
        continue;
      }

      const filterResult = sensitiveFilter(raw, settings.sensitiveWords);
      if (!filterResult.passed) {
        task.filteredCount++;
        this.addLog('warn', `Filtered (sensitive: ${filterResult.hits.join(', ')}): ${raw.title}`);
        continue;
      }

      const scoreResult = scoreArticle(raw, settings);

      if (settings.enableScoreFilter && !scoreResult.passed) {
        task.filteredCount++;
        this.addLog('info', `Filtered (low score ${scoreResult.score}): ${raw.title}`);
        continue;
      }

      const category = classifyArticle(raw);

      const contentImages = extractImagesFromContent(raw.content);
      const allImages = [...new Set([
        ...(raw.images || []),
        ...contentImages,
        ...(raw.imageUrl ? [raw.imageUrl] : []),
      ])].filter((url) => url.startsWith('http://') || url.startsWith('https://'));

      const junkThumbPattern = /logo|icon|favicon|head\.jpg|head\.png|avatar|badge|1x1|pixel|tracking|analytics|beacon|qrcode|二维码|share.icon|\/t\.png|\/t\.jpg|placeholder|spinner|loading|transparent\./i;
      const thumbImage = allImages.find((img) => !junkThumbPattern.test(img));

      let cleanSource = raw.source.replace(/\s+/g, ' ').trim();
      const words = cleanSource.split(' ');
      if (words.length === 2 && words[0] === words[1]) {
        cleanSource = words[0];
      }

      const candidate: CandidateArticle = {
        id: nanoid(10),
        title: raw.title,
        summary: raw.content.replace(/\[IMG:[^\]]+\]/g, '').slice(0, 150) + (raw.content.length > 150 ? '...' : ''),
        content: raw.content,
        url: raw.url,
        source: cleanSource,
        sourceId: raw.sourceId,
        publishedAt: raw.publishedAt,
        imageUrl: thumbImage || raw.imageUrl || allImages[0],
        images: allImages,
        videoUrl: raw.videoUrl,
        category,
        topicScore: scoreResult.score,
        scoreReasons: scoreResult.reasons,
      };

      task.candidates.push(candidate);
      task.fetchedCount++;

      const titleNorm = raw.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
      batchTitles.add(titleNorm);

      this.addLog('info', `✓ Candidate: ${raw.title} (score: ${scoreResult.score}, images: ${allImages.length})`);
      this.emitProgress(task);

      if (task.fetchedCount >= task.requestedCount) break;
    }

    task.candidates.sort((a, b) => b.topicScore - a.topicScore);

    if (settings.enableRewrite && settings.deepseekApiKey && task.candidates.length > 0) {
      this.addLog('info', `Starting AI rewrite for ${task.candidates.length} articles...`);
      this.emitSSE({
        type: 'progress',
        data: { fetched: task.fetchedCount, filtered: task.filteredCount, failed: task.failedCount, total: task.requestedCount, phase: 'rewriting' },
      });

      try {
        await rewriteBatch(task.candidates, settings, (done, total, current) => {
          this.addLog('info', `Rewrite ${done}/${total}: ${current}`);
          this.emitSSE({ type: 'rewrite-progress', data: { done, total, current } });
          saveTask(task);
        });
        this.addLog('info', `Rewrite completed`);
      } catch (err) {
        this.addLog('error', `Rewrite batch failed: ${String(err)}`);
      }
    }

    task.status = this.stopRequested ? 'stopped' : 'completed';
    task.endedAt = new Date().toISOString();

    this.addLog('info', `Task ${task.status}: ${task.fetchedCount} candidates, ${task.filteredCount} filtered, ${task.failedCount} failed`);

    saveTask(task);
    this.emitSSE({ type: 'complete', data: { taskId: task.id } });
  }

  private addLog(level: CrawlLogEntry['level'], message: string): void {
    const entry: CrawlLogEntry = {
      time: new Date().toISOString(),
      level,
      message,
    };
    this.currentTask?.logs.push(entry);
  }

  private emitProgress(task: CrawlTask): void {
    this.emitSSE({
      type: 'progress',
      data: {
        fetched: task.fetchedCount,
        filtered: task.filteredCount,
        failed: task.failedCount,
        total: task.requestedCount,
      },
    });
  }

  private emitSSE(event: SSEEvent): void {
    this.emit('sse', event);
  }
}

export const taskRunner = new TaskRunner();
