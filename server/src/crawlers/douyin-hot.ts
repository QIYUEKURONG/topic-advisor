import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';
import { fetch } from 'undici';

export const douyinHot: CrawlerAdapter = {
  id: 'douyin-hot',
  name: '抖音热搜',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const resp = await fetch('https://www.douyin.com/aweme/v1/web/hot/search/list/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://www.douyin.com/',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (resp.ok) {
        const json = (await resp.json()) as any;
        const items: any[] = json?.data?.word_list || json?.word_list || [];

        for (const item of items.slice(0, limit)) {
          const title = item.word || '';
          if (!title) continue;
          const hotValue = item.hot_value || '';
          const url = `https://www.douyin.com/search/${encodeURIComponent(title)}`;

          articles.push({
            title: cleanText(title),
            content: `抖音热搜: ${title}\n热度: ${hotValue}`,
            url,
            source: '抖音热搜',
            sourceId: 'douyin-hot',
          });
        }
      }
    } catch {
      // API might be blocked
    }

    if (articles.length === 0) {
      try {
        const html = await fetchHTML('https://www.douyin.com/hot');
        const $ = parseWithCheerio(html);

        $('a[href*="/search/"], [class*="hot"] a').each((_, el) => {
          if (articles.length >= limit) return false;
          const text = $(el).text().trim();
          const href = $(el).attr('href') || '';
          if (text.length > 2 && text.length < 60) {
            const fullUrl = href.startsWith('http') ? href : `https://www.douyin.com${href}`;
            articles.push({
              title: text,
              content: `抖音热搜: ${text}`,
              url: fullUrl,
              source: '抖音热搜',
              sourceId: 'douyin-hot',
            });
          }
        });
      } catch {
        // skip
      }
    }

    return articles;
  },
};
