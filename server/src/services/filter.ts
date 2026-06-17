import type { RawArticle } from '../types.js';

export interface FilterResult {
  passed: boolean;
  hits: string[];
}

export function sensitiveFilter(article: RawArticle, sensitiveWords: string[]): FilterResult {
  if (sensitiveWords.length === 0) {
    return { passed: true, hits: [] };
  }

  const text = `${article.title} ${article.content}`.toLowerCase();
  const hits: string[] = [];

  for (const word of sensitiveWords) {
    if (text.includes(word.toLowerCase())) {
      hits.push(word);
    }
  }

  return { passed: hits.length === 0, hits };
}

export function lengthFilter(article: RawArticle, minLength = 50): boolean {
  if (article.videoUrl) return article.content.length >= 10;
  return article.content.length >= minLength;
}
