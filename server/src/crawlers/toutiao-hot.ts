import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';
import { fetch } from 'undici';

export const toutiaoHot: CrawlerAdapter = {
  id: 'toutiao-hot',
  name: '今日头条热榜',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const resp = await fetch('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) return articles;
      const json = (await resp.json()) as any;
      const items: any[] = json?.data || [];

      for (const item of items.slice(0, limit)) {
        const title = item.Title || item.title || '';
        const url = item.Url || item.url || '';
        if (!title || !url) continue;

        const imageUrl = item.Image?.url || item.image_url || undefined;
        const hotValue = item.HotValue || item.hot_value || '';

        articles.push({
          title: cleanText(title),
          content: item.abstract || `热度: ${hotValue}\n\n${title}`,
          url: url.startsWith('http') ? url : `https://www.toutiao.com${url}`,
          source: '今日头条',
          sourceId: 'toutiao-hot',
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
        });
      }
    } catch {
      // fallback: scrape HTML
      try {
        const html = await fetchHTML('https://www.toutiao.com/');
        const $ = parseWithCheerio(html);

        $('a').each((_, el) => {
          if (articles.length >= limit) return false;
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          if (text.length > 8 && text.length < 100 && href.includes('/article/')) {
            const fullUrl = href.startsWith('http') ? href : `https://www.toutiao.com${href}`;
            if (!articles.some((a) => a.url === fullUrl)) {
              articles.push({
                title: text,
                content: text,
                url: fullUrl,
                source: '今日头条',
                sourceId: 'toutiao-hot',
              });
            }
          }
        });
      } catch {
        // skip
      }
    }

    return articles;
  },
};
