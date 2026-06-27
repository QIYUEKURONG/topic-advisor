import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

function createZhihuSearchCrawler(
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

      try {
        const url = `https://www.zhihu.com/search?type=content&q=${encodedQuery}`;
        const html = await fetchHTML(url);
        const $ = parseWithCheerio(html);

        const items: { url: string; title: string; excerpt: string }[] = [];

        $('.SearchResult-Card, .List-item').each((_, el) => {
          const titleEl = $(el).find('h2 a, .ContentItem-title a').first();
          const title = cleanText(titleEl.text());
          let href = titleEl.attr('href') || '';

          const excerptEl = $(el).find('.RichContent-inner, .CopyrightRichText-richText, span.RichText');
          const excerpt = cleanText(excerptEl.text()).slice(0, 500);

          if (title && title.length > 4 && href) {
            if (href.startsWith('//')) href = `https:${href}`;
            else if (href.startsWith('/')) href = `https://www.zhihu.com${href}`;
            items.push({ url: href, title, excerpt });
          }
        });

        if (items.length === 0) {
          $('a[href*="/question/"], a[href*="/answer/"]').each((_, el) => {
            const text = cleanText($(el).text());
            let href = $(el).attr('href') || '';
            if (text.length > 8 && text.length < 100 && href) {
              if (href.startsWith('/')) href = `https://www.zhihu.com${href}`;
              items.push({ url: href, title: text, excerpt: '' });
            }
          });
        }

        for (const item of items.slice(0, limit)) {
          let content = item.excerpt;

          try {
            const detailHtml = await fetchHTML(item.url);
            const $d = parseWithCheerio(detailHtml);

            $d('script, style, iframe, noscript').remove();

            const parts: string[] = [];
            $d('.RichContent-inner p, .Post-RichText p, .RichText p').each((_, el) => {
              const text = cleanText($d(el).text());
              if (text.length > 5) parts.push(text);
            });

            if (parts.length > 0) {
              content = parts.join('\n');
            }
          } catch {
            // use search excerpt
          }

          if (content.length < 30) continue;

          articles.push({
            title: item.title,
            content,
            url: item.url,
            source: '知乎',
            sourceId: id,
          });
        }
      } catch {
        // search failed
      }

      return articles;
    },
  };
}

function createMultiZhihuSearchCrawler(
  id: string,
  name: string,
  queries: string[],
): CrawlerAdapter {
  const singles = queries.map((q, i) =>
    createZhihuSearchCrawler(`${id}-${i}`, name, q),
  );

  return {
    id,
    name,
    async fetchList(limit: number): Promise<RawArticle[]> {
      const perQuery = Math.ceil(limit / singles.length);
      const all: RawArticle[] = [];
      const seen = new Set<string>();

      for (const crawler of singles) {
        try {
          const articles = await crawler.fetchList(perQuery);
          for (const a of articles) {
            const norm = a.title.replace(/\s+/g, '').toLowerCase();
            if (!seen.has(norm)) {
              seen.add(norm);
              a.sourceId = id;
              all.push(a);
            }
          }
        } catch {
          // skip
        }
      }

      return all.slice(0, limit);
    },
  };
}

export const zhihuSideHustle = createMultiZhihuSearchCrawler(
  'zhihu-sidehustle',
  '知乎副业',
  [
    '副业做什么好 真实经历',
    '程序员接私活 经验分享',
    '下班后做什么赚钱 月入',
    '自由职业 远程工作 真实收入',
  ],
);
