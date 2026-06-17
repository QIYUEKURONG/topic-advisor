import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const kr36: CrawlerAdapter = {
  id: '36kr',
  name: '36氪',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://36kr.com/hot-list/catalog');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const fullUrl = href.startsWith('/p/') ? `https://36kr.com${href}` : href;

        if (
          fullUrl.includes('36kr.com/p/') &&
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

          const selector = '.article-content, [class*="articleDetailContent"], [class*="common-width"]';
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
            source: '36氪',
            sourceId: '36kr',
            imageUrl,
            images,
            publishedAt: $d('[class*="time"], [class*="date"]').first().text().trim() || undefined,
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
