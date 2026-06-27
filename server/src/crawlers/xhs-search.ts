import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

function createXhsSearchCrawler(
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
        const url = `https://www.xiaohongshu.com/search_result?keyword=${encodedQuery}&type=1`;
        const html = await fetchHTML(url);
        const $ = parseWithCheerio(html);

        const items: { url: string; title: string; desc: string; image?: string }[] = [];

        $('a[href*="/explore/"], a[href*="/discovery/item/"], .note-item a, section a').each((_, el) => {
          const href = $(el).attr('href') || '';
          const titleEl = $(el).find('.title, .note-title, h3, span').first();
          const title = cleanText(titleEl.text() || $(el).text());
          const desc = cleanText($(el).find('.desc, .note-desc, p').text());
          const img = $(el).find('img').first().attr('src') || '';

          if (title.length > 4 && title.length < 100 && href) {
            const fullUrl = href.startsWith('/') ? `https://www.xiaohongshu.com${href}` : href;
            items.push({
              url: fullUrl.split('?')[0],
              title,
              desc,
              image: img && img.startsWith('http') ? img : undefined,
            });
          }
        });

        const seen = new Set<string>();
        for (const item of items.slice(0, limit)) {
          if (seen.has(item.title)) continue;
          seen.add(item.title);

          let content = item.desc || item.title;

          try {
            const detailHtml = await fetchHTML(item.url);
            const $d = parseWithCheerio(detailHtml);
            $d('script, style, iframe').remove();

            const parts: string[] = [];
            $d('.note-text p, .content p, #detail-desc span, .note-content span').each((_, el) => {
              const text = cleanText($d(el).text());
              if (text.length > 3) parts.push(text);
            });

            if (parts.length > 0) content = parts.join('\n');
          } catch {
            // use excerpt
          }

          if (content.length < 20) continue;

          articles.push({
            title: item.title,
            content,
            url: item.url,
            source: '小红书',
            sourceId: id,
            imageUrl: item.image,
            images: item.image ? [item.image] : [],
          });
        }
      } catch {
        // search failed, try Bing as fallback
        try {
          const bingUrl = `https://www.bing.com/search?q=site:xiaohongshu.com+${encodeURIComponent(searchQuery)}`;
          const html = await fetchHTML(bingUrl);
          const $ = parseWithCheerio(html);

          $('li.b_algo, .b_algo').each((_, el) => {
            if (articles.length >= limit) return;
            const titleEl = $(el).find('h2 a').first();
            const title = cleanText(titleEl.text());
            const href = titleEl.attr('href') || '';
            const snippet = cleanText($(el).find('.b_caption p, .b_lineclamp2').text());

            if (title && href.includes('xiaohongshu') && snippet.length > 20) {
              articles.push({
                title,
                content: snippet,
                url: href,
                source: '小红书',
                sourceId: id,
              });
            }
          });
        } catch {
          // both failed
        }
      }

      return articles;
    },
  };
}

function createMultiXhsSearchCrawler(
  id: string,
  name: string,
  queries: string[],
): CrawlerAdapter {
  const singles = queries.map((q, i) =>
    createXhsSearchCrawler(`${id}-${i}`, name, q),
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

export const xhsSideHustle = createMultiXhsSearchCrawler(
  'xhs-sidehustle',
  '小红书副业',
  [
    '副业赚钱 真实经历',
    '下班后兼职 月入',
    '自由职业 远程 经验',
    '闲鱼赚钱 实操',
  ],
);
