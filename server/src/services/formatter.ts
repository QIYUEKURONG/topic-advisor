import type { CandidateArticle, Settings } from '../types.js';

export function formatAsRepost(article: CandidateArticle, settings: Settings): string {
  const notice = settings.repostTemplate
    .replace('{source}', article.source)
    .replace('{url}', article.url);

  return [
    `# ${article.title}`,
    '',
    `> ${notice}`,
    '',
    article.content,
    '',
    '---',
    '',
    `- 来源: ${article.source}`,
    `- 原文链接: ${article.url}`,
    article.publishedAt ? `- 发布时间: ${article.publishedAt}` : '',
    `- 话题分: ${article.topicScore}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function generateManifest(
  articles: CandidateArticle[],
  taskId: string,
  exportDir: string,
): object {
  return {
    taskId,
    exportedAt: new Date().toISOString(),
    exportDir,
    count: articles.length,
    articles: articles.map((a, i) => ({
      index: i + 1,
      id: a.id,
      title: a.title,
      source: a.source,
      url: a.url,
      topicScore: a.topicScore,
      filename: `${String(i + 1).padStart(3, '0')}_${slugify(a.title)}.md`,
    })),
  };
}

function slugify(text: string): string {
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}
