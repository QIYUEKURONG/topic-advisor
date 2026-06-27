import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

function createBaiduSiteSearchCrawler(
  id: string,
  name: string,
  site: string,
  searchQueries: string[],
  sourceName: string,
): CrawlerAdapter {
  return {
    id,
    name,
    async fetchList(limit: number): Promise<RawArticle[]> {
      const articles: RawArticle[] = [];
      const seen = new Set<string>();
      const perQuery = Math.ceil(limit / searchQueries.length);

      for (const query of searchQueries) {
        if (articles.length >= limit) break;

        try {
          const baiduQuery = `site:${site} ${query}`;
          const url = `https://www.baidu.com/s?wd=${encodeURIComponent(baiduQuery)}&rn=${Math.min(perQuery * 2, 50)}`;
          const html = await fetchHTML(url);
          const $ = parseWithCheerio(html);

          $('.result, .c-container').each((_, el) => {
            if (articles.length >= limit) return;

            const titleEl = $(el).find('h3 a, .t a').first();
            const rawTitle = cleanText(titleEl.text());
            const title = rawTitle
              .replace(/\s*-\s*(知乎|小红书|豆瓣|简书|百度知道).*$/, '')
              .replace(/\s*_.*$/, '')
              .trim();
            const href = titleEl.attr('href') || '';
            const snippet = cleanText($(el).find('.c-abstract, .c-span-last, .content-right_8Zs40').text());

            if (!title || title.length < 5 || !href || seen.has(title)) return;
            if (snippet.length < 15) return;
            seen.add(title);

            articles.push({
              title,
              content: snippet,
              url: href,
              source: sourceName,
              sourceId: id,
            });
          });
        } catch {
          // query failed
        }
      }

      return articles;
    },
  };
}

export const zhihuSideHustleSearch = createBaiduSiteSearchCrawler(
  'zhihu-sidehustle',
  '知乎副业',
  'zhihu.com',
  [
    '副业赚钱 真实经历',
    '程序员 副业 接私活 经验',
    '普通人 兼职 月入 赚钱方法',
    '自由职业 远程工作 怎么开始',
  ],
  '知乎',
);

export const xhsSideHustleSearch = createBaiduSiteSearchCrawler(
  'xhs-sidehustle',
  '小红书副业',
  'xiaohongshu.com',
  [
    '副业赚钱 真实经历',
    '下班后兼职 月入',
    '闲鱼赚钱 攻略',
    '在家赚钱 方法',
  ],
  '小红书',
);
