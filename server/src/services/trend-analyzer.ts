import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAllCrawlers } from '../crawlers/registry.js';
import type { RawArticle } from '../types.js';
import { getSettings } from '../config/settings.js';

export interface EngagementData {
  reads?: number;
  comments?: number;
  likes?: number;
  shares?: number;
  score: number;
}

export interface TrendItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  content: string;
  engagement: EngagementData;
  keywords: string[];
  category: string;
  fetchedAt: string;
}

export interface HotTopic {
  keyword: string;
  count: number;
  avgEngagement: number;
  topArticles: TrendItem[];
  trend: 'rising' | 'stable' | 'declining';
}

export interface TrendSnapshot {
  id: string;
  date: string;
  platform?: string;
  direction?: string;
  items: TrendItem[];
  hotTopics: HotTopic[];
  createdAt: string;
}

export interface ViralAnalysis {
  score: number;
  maxScore: number;
  breakdown: { label: string; score: number; maxScore: number; reason: string }[];
  matchedTrends: string[];
  suggestions: string[];
}

function getTrendDir(): string {
  const dataRoot = process.env.TOPIC_ADVISOR_DATA || resolve(process.cwd(), 'data');
  const dir = join(dataRoot, 'trends');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const ENGAGEMENT_PATTERNS: Array<{ pattern: RegExp; field: keyof EngagementData; multiplier: number }> = [
  { pattern: /(\d+(?:\.\d+)?)\s*万\s*(?:播放|观看|阅读|浏览)/i, field: 'reads', multiplier: 10000 },
  { pattern: /(?:播放|观看|阅读|浏览)[：:]\s*(\d+(?:\.\d+)?)\s*万/i, field: 'reads', multiplier: 10000 },
  { pattern: /(\d+(?:,\d+)?)\s*(?:播放|观看|阅读|浏览)/i, field: 'reads', multiplier: 1 },
  { pattern: /(\d+(?:\.\d+)?)\s*万\s*(?:评论|回复)/i, field: 'comments', multiplier: 10000 },
  { pattern: /(\d+(?:,\d+)?)\s*(?:评论|回复|回答)/i, field: 'comments', multiplier: 1 },
  { pattern: /(\d+(?:\.\d+)?)\s*万\s*(?:点赞|赞|喜欢|收藏)/i, field: 'likes', multiplier: 10000 },
  { pattern: /(\d+(?:,\d+)?)\s*(?:点赞|赞|喜欢|收藏)/i, field: 'likes', multiplier: 1 },
  { pattern: /(\d+(?:\.\d+)?)\s*万\s*(?:转发|分享)/i, field: 'shares', multiplier: 10000 },
  { pattern: /(\d+(?:,\d+)?)\s*(?:转发|分享)/i, field: 'shares', multiplier: 1 },
];

function extractEngagement(text: string): EngagementData {
  const data: EngagementData = { score: 0 };

  for (const { pattern, field, multiplier } of ENGAGEMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match && field !== 'score') {
      const val = parseFloat(match[1].replace(/,/g, '')) * multiplier;
      if (!data[field] || val > (data[field] as number)) {
        (data as any)[field] = Math.round(val);
      }
    }
  }

  data.score = (data.reads || 0) * 0.3 + (data.comments || 0) * 3 + (data.likes || 0) * 1 + (data.shares || 0) * 2;
  if (data.score === 0) {
    data.score = Math.random() * 10 + 1;
  }

  return data;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'AI/科技': ['AI', '人工智能', 'GPT', 'ChatGPT', '大模型', '机器学习', '深度学习', 'AGI', '芯片', '算力', '自动驾驶', '量子', 'AIGC'],
  '副业赚钱': ['副业', '兼职', '赚钱', '月入', '接单', '私活', '变现', '自由职业', '被动收入', '创业', '搞钱'],
  '理财投资': ['股票', '基金', '理财', '投资', '收益', '分红', 'ETF', '定投', '债券', '房产'],
  '自媒体': ['公众号', '抖音', '小红书', 'B站', '头条号', '自媒体', '涨粉', '流量', '运营', '内容创作'],
  '职场': ['跳槽', '面试', '简历', '涨薪', '裁员', '职场', '管理', '领导力', '升职'],
  '生活方式': ['健身', '减肥', '旅行', '美食', '穿搭', '护肤', '家居', '养生'],
  '教育': ['考研', '考公', '留学', '英语', '编程', '课程', '学习', '考证'],
  '热点事件': ['热搜', '最新', '突发', '刷屏', '爆火', '火了', '全网'],
};

function extractKeywords(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        if (!found.includes(kw)) found.push(kw);
      }
    }
  }

  return found;
}

function classifyCategory(keywords: string[]): string {
  const scores: Record<string, number> = {};

  for (const kw of keywords) {
    for (const [cat, catKeywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (catKeywords.some((ck) => ck.toLowerCase() === kw.toLowerCase())) {
        scores[cat] = (scores[cat] || 0) + 1;
      }
    }
  }

  let best = '其他';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return best;
}

function buildHotTopics(items: TrendItem[], previousSnapshot?: TrendSnapshot): HotTopic[] {
  const keywordMap = new Map<string, TrendItem[]>();

  for (const item of items) {
    for (const kw of item.keywords) {
      if (!keywordMap.has(kw)) keywordMap.set(kw, []);
      keywordMap.get(kw)!.push(item);
    }
  }

  const previousCounts = new Map<string, number>();
  if (previousSnapshot) {
    for (const topic of previousSnapshot.hotTopics) {
      previousCounts.set(topic.keyword, topic.count);
    }
  }

  const topics: HotTopic[] = [];

  for (const [keyword, articles] of keywordMap) {
    if (articles.length < 2) continue;

    const sorted = [...articles].sort((a, b) => b.engagement.score - a.engagement.score);
    const avgEngagement = sorted.reduce((sum, a) => sum + a.engagement.score, 0) / sorted.length;
    const prevCount = previousCounts.get(keyword) || 0;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (articles.length > prevCount * 1.3) trend = 'rising';
    else if (articles.length < prevCount * 0.7 && prevCount > 0) trend = 'declining';

    topics.push({
      keyword,
      count: articles.length,
      avgEngagement: Math.round(avgEngagement),
      topArticles: sorted.slice(0, 5),
      trend,
    });
  }

  return topics.sort((a, b) => b.count * b.avgEngagement - a.count * a.avgEngagement).slice(0, 30);
}

export async function runTrendCrawl(
  sourceIds?: string[],
  direction?: string,
): Promise<TrendSnapshot> {
  const allCrawlers = getAllCrawlers();
  const crawlers = sourceIds
    ? allCrawlers.filter((c) => sourceIds.includes(c.id))
    : allCrawlers;

  const items: TrendItem[] = [];
  const seen = new Set<string>();

  for (const crawler of crawlers) {
    try {
      const raw = await crawler.fetchList(30);
      for (const article of raw) {
        const normTitle = article.title.replace(/\s+/g, '').toLowerCase();
        if (seen.has(normTitle)) continue;
        seen.add(normTitle);

        const fullText = article.title + ' ' + article.content;
        const engagement = extractEngagement(fullText);
        const keywords = extractKeywords(fullText);

        if (direction) {
          const dirKeywords = TOPIC_KEYWORDS[direction] || [direction];
          const hasMatch = dirKeywords.some((dk) => fullText.toLowerCase().includes(dk.toLowerCase()));
          if (!hasMatch) continue;
        }

        items.push({
          id: generateId(),
          title: article.title,
          url: article.url,
          source: article.source,
          sourceId: article.sourceId,
          content: article.content.slice(0, 500),
          engagement,
          keywords,
          category: classifyCategory(keywords),
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch {
      // crawler failed
    }
  }

  items.sort((a, b) => b.engagement.score - a.engagement.score);

  const prev = getLatestSnapshot() ?? undefined;

  const snapshot: TrendSnapshot = {
    id: generateId(),
    date: today(),
    platform: sourceIds?.join(','),
    direction,
    items: items.slice(0, 200),
    hotTopics: buildHotTopics(items, prev),
    createdAt: new Date().toISOString(),
  };

  saveTrendSnapshot(snapshot);
  return snapshot;
}

export function analyzeViralPotential(title: string, content: string): ViralAnalysis {
  const fullText = title + ' ' + content;
  const keywords = extractKeywords(fullText);
  const latest = getLatestSnapshot();

  const breakdown: ViralAnalysis['breakdown'] = [];
  let totalScore = 0;
  const maxScore = 100;

  const hotKeywords = latest?.hotTopics.map((t) => t.keyword) || [];
  const matchedTrends = keywords.filter((kw) => hotKeywords.includes(kw));
  const trendScore = Math.min(matchedTrends.length * 8, 30);
  totalScore += trendScore;
  breakdown.push({
    label: '热点匹配',
    score: trendScore,
    maxScore: 30,
    reason: matchedTrends.length > 0 ? `命中热点: ${matchedTrends.join(', ')}` : '未命中当前热点',
  });

  const titleLen = title.length;
  let titleScore = 0;
  if (titleLen >= 10 && titleLen <= 30) titleScore = 15;
  else if (titleLen >= 5 && titleLen <= 50) titleScore = 10;
  else titleScore = 5;

  const hookWords = ['揭秘', '震惊', '必看', '实测', '真相', '秘密', '干货', '避坑', '血泪', '翻车', '逆袭', '暴涨', '爆火'];
  if (hookWords.some((w) => title.includes(w))) titleScore += 5;

  const numberMatch = title.match(/\d+/);
  if (numberMatch) titleScore += 3;

  totalScore += Math.min(titleScore, 20);
  breakdown.push({
    label: '标题质量',
    score: Math.min(titleScore, 20),
    maxScore: 20,
    reason: `标题${titleLen}字${hookWords.some((w) => title.includes(w)) ? '，含钩子词' : ''}${numberMatch ? '，含数字' : ''}`,
  });

  const contentLen = content.length;
  let depthScore = 0;
  if (contentLen >= 800) depthScore = 20;
  else if (contentLen >= 400) depthScore = 15;
  else if (contentLen >= 200) depthScore = 10;
  else depthScore = 5;

  totalScore += depthScore;
  breakdown.push({
    label: '内容深度',
    score: depthScore,
    maxScore: 20,
    reason: `内容${contentLen}字${contentLen >= 800 ? '，深度充足' : contentLen >= 400 ? '，长度适中' : '，偏短'}`,
  });

  const uniqueKw = new Set(keywords);
  const diversityScore = Math.min(uniqueKw.size * 3, 15);
  totalScore += diversityScore;
  breakdown.push({
    label: '话题覆盖',
    score: diversityScore,
    maxScore: 15,
    reason: `覆盖${uniqueKw.size}个关键词`,
  });

  const emotionWords = ['我', '吧', '啊', '哈', '真的', '其实', '说实话', '坦白说', '踩坑', '翻车', '爽', '崩溃'];
  const emotionHits = emotionWords.filter((w) => fullText.includes(w)).length;
  const emotionScore = Math.min(emotionHits * 3, 15);
  totalScore += emotionScore;
  breakdown.push({
    label: '人味/情感',
    score: emotionScore,
    maxScore: 15,
    reason: emotionHits > 0 ? `检测到${emotionHits}个情感词` : '缺少口语化/情感表达',
  });

  const suggestions: string[] = [];
  if (trendScore < 15) suggestions.push(`建议关注当前热点: ${hotKeywords.slice(0, 5).join(', ')}`);
  if (titleScore < 15) suggestions.push('标题可以更有吸引力，加入数字或钩子词');
  if (depthScore < 15) suggestions.push('内容可以更深入，建议800字以上');
  if (emotionScore < 8) suggestions.push('增加口语化表达和个人经历，更有人味');
  if (matchedTrends.length === 0) suggestions.push('试试蹭一下当前热门话题');

  return {
    score: totalScore,
    maxScore,
    breakdown,
    matchedTrends,
    suggestions,
  };
}

function saveTrendSnapshot(snapshot: TrendSnapshot): void {
  const dir = getTrendDir();
  writeFileSync(join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2), 'utf-8');
}

export function getLatestSnapshot(): TrendSnapshot | null {
  const dir = getTrendDir();
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;

  files.sort().reverse();
  try {
    return JSON.parse(readFileSync(join(dir, files[0]), 'utf-8'));
  } catch {
    return null;
  }
}

export function listSnapshots(limit = 30): Array<{ id: string; date: string; itemCount: number; topicCount: number; createdAt: string }> {
  const dir = getTrendDir();
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  files.sort().reverse();

  return files.slice(0, limit).map((f) => {
    try {
      const snap = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as TrendSnapshot;
      return {
        id: snap.id,
        date: snap.date,
        itemCount: snap.items.length,
        topicCount: snap.hotTopics.length,
        createdAt: snap.createdAt,
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as any[];
}

export function getSnapshot(id: string): TrendSnapshot | null {
  const dir = getTrendDir();
  const path = join(dir, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function getAvailablePlatforms(): Array<{ id: string; name: string }> {
  return getAllCrawlers().map((c) => ({ id: c.id, name: c.name }));
}

export function getAvailableDirections(): Array<{ id: string; label: string; keywords: string[] }> {
  return Object.entries(TOPIC_KEYWORDS).map(([label, keywords]) => ({
    id: label,
    label,
    keywords,
  }));
}
