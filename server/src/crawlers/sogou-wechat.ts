import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

const JUNK_TITLE_PATTERNS = [
  /警惕/, /诈骗/, /骗局/, /传销/, /举报/, /被骗/, /维权/,
  /犯罪/, /刑拘/, /逮捕/, /判刑/, /起诉/,
  /广告/, /推广/, /招商加盟/,
];

function isJunkTitle(title: string): boolean {
  return JUNK_TITLE_PATTERNS.some(p => p.test(title));
}

function createWechatSearchCrawler(
  id: string,
  name: string,
  searchQuery: string,
): CrawlerAdapter {
  return {
    id,
    name,
    async fetchList(limit: number): Promise<RawArticle[]> {
      const articles: RawArticle[] = [];
      const encodedQuery = encodeURIComponent(searchQuery);
      const url = `https://weixin.sogou.com/weixin?type=2&query=${encodedQuery}&ie=utf8&tsn=2&ft=&et=`;

      try {
        const html = await fetchHTML(url);
        const $ = parseWithCheerio(html);

        const items: { url: string; title: string; desc: string; source: string }[] = [];

        $('.news-list li, .news-box li, [class*="news-list"] li').each((_, el) => {
          const titleEl = $(el).find('h3 a, .txt-box h3 a').first();
          const href = titleEl.attr('href') || '';
          const title = cleanText(titleEl.text());
          const desc = cleanText($(el).find('.txt-info, p.txt-info, .s-p').text());
          const source = cleanText($(el).find('.s-p .all-time-y, .account, .s2').text());

          if (href && title && !isJunkTitle(title)) {
            const fullUrl = href.startsWith('http') ? href : `https://weixin.sogou.com${href}`;
            items.push({ url: fullUrl, title, desc, source: source || '公众号' });
          }
        });

        for (const item of items.slice(0, limit)) {
          try {
            const detailHtml = await fetchHTML(item.url);
            const $d = parseWithCheerio(detailHtml);

            $d('script, style, iframe, noscript').remove();

            const contentParts: string[] = [];
            $d('#js_content p, .rich_media_content p, #js_content section').each((_, el) => {
              const text = cleanText($d(el).text());
              if (text.length > 5) contentParts.push(text);
            });

            const content = contentParts.length > 0
              ? contentParts.join('\n')
              : item.desc;

            if (content.length < 50) continue;

            articles.push({
              title: item.title,
              content,
              url: item.url,
              source: `公众号·${item.source}`,
              sourceId: id,
            });
          } catch {
            if (item.desc.length > 30) {
              articles.push({
                title: item.title,
                content: item.desc,
                url: item.url,
                source: `公众号·${item.source}`,
                sourceId: id,
              });
            }
          }
        }
      } catch {
        // search failed
      }

      return articles;
    },
  };
}

function createMultiWechatSearchCrawler(
  id: string,
  name: string,
  searchQueries: string[],
): CrawlerAdapter {
  const singleCrawlers = searchQueries.map((q, i) =>
    createWechatSearchCrawler(`${id}-${i}`, name, q),
  );

  return {
    id,
    name,
    async fetchList(limit: number): Promise<RawArticle[]> {
      const perQuery = Math.ceil(limit / singleCrawlers.length);
      const allArticles: RawArticle[] = [];
      const seenTitles = new Set<string>();

      for (const crawler of singleCrawlers) {
        try {
          const articles = await crawler.fetchList(perQuery);
          for (const a of articles) {
            const normTitle = a.title.replace(/\s+/g, '').toLowerCase();
            if (!seenTitles.has(normTitle) && !isJunkTitle(a.title)) {
              seenTitles.add(normTitle);
              a.sourceId = id;
              allArticles.push(a);
            }
          }
        } catch {
          // skip
        }
      }

      return allArticles.slice(0, limit);
    },
  };
}

export const wechatSideHustle = createMultiWechatSearchCrawler(
  'wechat-sidehustle',
  '公众号副业',
  [
    '副业赚钱 实操经验 分享',
    '兼职 月入 真实经历',
    '自由职业 远程接单 经验',
    '独立开发 变现 收入',
  ],
);

export const wechatHot = createMultiWechatSearchCrawler(
  'wechat-hot',
  '公众号热门',
  [
    '今日热点 深度分析',
    '最新趋势 行业报告',
    '深度好文 万赞',
    '10万+ 爆文',
  ],
);
