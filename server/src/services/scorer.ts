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

  const interactionText = article.title + ' ' + article.content;
  if (/\d+万\+?\s*(播放|观看|浏览|阅读)/.test(interactionText) || /播放量.*万|阅读量.*万/.test(interactionText)) {
    score += 25;
    reasons.push('超高浏览量(万级) +25');
  } else if (/播放量.*千|阅读量.*千|\d+千\+?\s*(播放|观看)/.test(interactionText)) {
    score += 15;
    reasons.push('高浏览量(千级) +15');
  }

  if (/\d+万\+?\s*(点赞|赞|喜欢|收藏)/.test(interactionText) || /点赞.*万|收藏.*万/.test(interactionText)) {
    score += 20;
    reasons.push('超高互动(万级点赞/收藏) +20');
  } else if (/\d+千\+?\s*(点赞|赞|喜欢|收藏)|点赞.*千|收藏.*千/.test(interactionText)) {
    score += 12;
    reasons.push('高互动(千级点赞/收藏) +12');
  } else if (/\d{3,}\s*(点赞|赞|喜欢|收藏|评论|回复)/.test(interactionText)) {
    score += 8;
    reasons.push('中互动(百级互动) +8');
  }

  const NEGATIVE_PATTERNS = [
    /警惕/, /诈骗/, /骗局/, /传销/, /被骗/, /维权/, /举报/,
    /犯罪/, /刑拘/, /逮捕/, /判刑/, /起诉/, /罚款/,
  ];
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(article.title)) {
      score -= 30;
      reasons.push(`标题含负面词 "${pattern.source}" -30`);
    }
  }

  const threshold = THRESHOLDS[settings.topicMode];
  return {
    score: Math.min(score, 100),
    passed: score >= threshold,
    reasons,
  };
}
