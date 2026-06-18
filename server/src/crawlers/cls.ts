import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';
import { fetch } from 'undici';

export const clsFinance: CrawlerAdapter = {
  id: 'cls-finance',
  name: '财联社',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.cls.cn/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('/detail/') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.title === text)
        ) {
          const fullUrl = href.startsWith('http') ? href : `https://www.cls.cn${href}`;
          links.push({ url: fullUrl, title: text });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.detail-content, .article-content, .detail-text';
          const content = extractContentWithImages($d, selector);
          let imageUrl = extractFirstImage($d, selector);
          const images = extractAllImages($d, selector);

          if (!imageUrl) {
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
            source: '财联社',
            sourceId: 'cls-finance',
            imageUrl: imageUrl || images[0],
            images,
          });
        } catch {
          // skip
        }
      }
    } catch {
      // source failure
    }

    return articles;
  },
};
