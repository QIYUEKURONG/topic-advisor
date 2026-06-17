import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CrawlTask, CandidateArticle, Settings } from '../types.js';
import { formatAsRepost, generateManifest } from './formatter.js';

const TASKS_DIR = resolve(process.cwd(), 'data/tasks');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveTask(task: CrawlTask): void {
  ensureDir(TASKS_DIR);
  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2), 'utf-8');
}

export function loadTask(id: string): CrawlTask | null {
  const path = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function listTasks(): CrawlTask[] {
  ensureDir(TASKS_DIR);
  const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8')) as CrawlTask;
      } catch {
        return null;
      }
    })
    .filter((t): t is CrawlTask => t !== null)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getHistoryUrls(windowHours = 24): Set<string> {
  const tasks = listTasks();
  const urls = new Set<string>();
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;

  for (const task of tasks) {
    const taskTime = new Date(task.startedAt).getTime();
    if (taskTime < cutoff) continue;

    for (const candidate of task.candidates) {
      urls.add(candidate.url);
    }
  }
  return urls;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function getHistoryTitles(windowHours = 24): Set<string> {
  const tasks = listTasks();
  const titles = new Set<string>();
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;

  for (const task of tasks) {
    const taskTime = new Date(task.startedAt).getTime();
    if (taskTime < cutoff) continue;

    for (const candidate of task.candidates) {
      titles.add(normalizeTitle(candidate.title));
    }
  }
  return titles;
}

export function isTitleDuplicate(title: string, historyTitles: Set<string>, batchTitles: Set<string>): boolean {
  const norm = normalizeTitle(title);
  if (norm.length < 4) return false;
  if (historyTitles.has(norm) || batchTitles.has(norm)) return true;

  for (const existing of [...historyTitles, ...batchTitles]) {
    if (existing.length < 4) continue;
    const shorter = norm.length < existing.length ? norm : existing;
    const longer = norm.length < existing.length ? existing : norm;
    if (longer.includes(shorter) && shorter.length >= longer.length * 0.6) {
      return true;
    }
  }
  return false;
}

export function exportSelected(
  task: CrawlTask,
  articleIds: string[],
  settings: Settings,
): string {
  const selected = task.candidates.filter((a) => articleIds.includes(a.id));
  if (selected.length === 0) throw new Error('No articles selected');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const exportDir = resolve(settings.outputDir, 'crawls', timestamp);
  const articlesDir = join(exportDir, 'articles');
  ensureDir(articlesDir);

  selected.forEach((article, i) => {
    const filename = `${String(i + 1).padStart(3, '0')}_${slugify(article.title)}.md`;
    const content = formatAsRepost(article, settings);
    writeFileSync(join(articlesDir, filename), content, 'utf-8');
  });

  const manifest = generateManifest(selected, task.id, exportDir);
  writeFileSync(join(exportDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  const logLines = task.logs.map((l) => `[${l.time}] [${l.level.toUpperCase()}] ${l.message}`);
  writeFileSync(join(exportDir, 'crawl.log'), logLines.join('\n'), 'utf-8');

  return exportDir;
}

function slugify(text: string): string {
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}
