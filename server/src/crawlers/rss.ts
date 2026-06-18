import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

function createRSSCrawler(id: string, name: string, feedUrl: string): CrawlerAdapter {
  return {
    id,
    name,

    async fetchList(limit: number): Promise<RawArticle[]> {
      const articles: RawArticle[] = [];

      try {
        const xml = await fetchHTML(feedUrl);
        const $ = parseWithCheerio(xml);

        const items = $('item, entry').toArray();

        for (const item of items.slice(0, limit)) {
          const title = $(item).find('title').first().text().trim();
          const link =
            $(item).find('link').first().attr('href') ||
            $(item).find('link').first().text().trim() ||
            $(item).find('guid').first().text().trim();
          const description =
            $(item).find('description, summary, content\\:encoded').first().text().trim();
          const pubDate = $(item).find('pubDate, published, updated').first().text().trim();

          if (!title || !link) continue;

          const $desc = parseWithCheerio(description || '');
          const plainText = cleanText($desc.text());
          const imgMatch = description.match(/<img[^>]+src=["']([^"']+)/);
          const imageUrl = imgMatch?.[1] && imgMatch[1].startsWith('http') ? imgMatch[1] : undefined;

          articles.push({
            title: cleanText(title),
            content: plainText || title,
            url: link,
            source: name,
            sourceId: id,
            imageUrl,
            images: imageUrl ? [imageUrl] : [],
            publishedAt: pubDate || undefined,
          });
        }
      } catch {
        // RSS feed failure
      }

      return articles;
    },
  };
}

export const peopleDaily = createRSSCrawler(
  'people-daily',
  '人民网',
  'http://www.people.com.cn/rss/politics.xml',
);

export const bbc_zh = createRSSCrawler(
  'bbc-zhongwen',
  'BBC中文',
  'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
);

export const infzm = createRSSCrawler(
  'infzm',
  '南方周末',
  'https://rsshub.app/infzm/2',
);

export const jiemian = createRSSCrawler(
  'jiemian',
  '界面新闻',
  'https://rsshub.app/jiemian/list/4',
);

export const wallstreetcn = createRSSCrawler(
  'wallstreetcn',
  '华尔街见闻',
  'https://rsshub.app/wallstreetcn/news/global',
);

export const caixin = createRSSCrawler(
  'caixin',
  '财新网',
  'https://rsshub.app/caixin/latest',
);
