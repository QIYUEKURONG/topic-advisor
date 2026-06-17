import type { RawArticle, Settings } from '../types.js';

export interface ScoreResult {
  score: number;
  passed: boolean;
  reasons: string[];
}

const THRESHOLDS: Record<Settings['topicMode'], number> = {
  loose: 10,
  standard: 20,
  strict: 40,
};

export function scoreArticle(article: RawArticle, settings: Settings): ScoreResult {
  const text = `${article.title} ${article.content}`;
  const reasons: string[] = [];
  let score = 0;

  for (const keyword of settings.topicKeywords) {
    if (text.includes(keyword)) {
      score += 12;
      reasons.push(`命中关键词: ${keyword} +12`);
    }
  }

  const titleLen = article.title.length;
  if (titleLen > 15 && titleLen < 40) {
    score += 5;
    reasons.push('标题长度适中 +5');
  }

  if (article.content.length > 500) {
    score += 8;
    reasons.push('内容充实(>500字) +8');
  }

  if (/[！？!?]{1,}/.test(article.title)) {
    score += 6;
    reasons.push('标题含感叹/问号 +6');
  }

  if (/["「『"'].+["」』"']/.test(article.title)) {
    score += 4;
    reasons.push('标题含引述 +4');
  }

  if (article.videoUrl) {
    score += 15;
    reasons.push('视频内容 +15');
  }

  if (article.sourceId === 'weibo-hot' || article.sourceId === 'bilibili-hot') {
    score += 20;
    reasons.push('热门平台 +20');
  }

  if (/播放量.*万|点赞.*万/.test(article.content)) {
    score += 10;
    reasons.push('高互动量 +10');
  }

  const threshold = THRESHOLDS[settings.topicMode];
  return {
    score: Math.min(score, 100),
    passed: score >= threshold,
    reasons,
  };
}
