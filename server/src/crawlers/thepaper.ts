import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const thepaper: CrawlerAdapter = {
  id: 'thepaper',
  name: '澎湃新闻',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.thepaper.cn/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const fullUrl = href.startsWith('/newsDetail_forward_')
          ? `https://www.thepaper.cn${href}`
          : href;

        if (
          fullUrl.includes('thepaper.cn') &&
          fullUrl.includes('newsDetail_forward_') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === fullUrl)
        ) {
          links.push({ url: fullUrl, title: text });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.news_txt, .newsDetail_content, [class*="index_cententWrap"]';
          const content = extractContentWithImages($d, selector);
          let imageUrl = extractFirstImage($d, selector);
          const images = extractAllImages($d, selector);
          if (!imageUrl && images.length === 0) {
            const ogImg = extractOgImage($d);
            if (ogImg) {
              imageUrl = ogImg;
              images.push(ogImg);
            }
          }

          if (content.length < 30) continue;

          articles.push({
            title: link.title,
            content,
            url: link.url,
            source: '澎湃新闻',
            sourceId: 'thepaper',
            imageUrl,
            images,
            publishedAt: $d('[class*="time"], .news_about .author span, [class*="date"]').first().text().trim() || undefined,
          });
        } catch {
          // skip
        }
      }
    } catch {
      // source-level
    }

    return articles;
  },
};
