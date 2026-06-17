import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const ithome: CrawlerAdapter = {
  id: 'ithome',
  name: 'IT之家',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.ithome.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('ithome.com/0/') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href)
        ) {
          const fullUrl = href.startsWith('//') ? `https:${href}` : href;
          links.push({ url: fullUrl, title: text });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '#paragraph, .post_content, .content, .article-content';

          // IT之家 uses lazy-load: real images in data-original, src is a placeholder (t.png)
          $d(`${selector} img`).each((_, img) => {
            const dataOriginal = $d(img).attr('data-original') || '';
            if (dataOriginal && dataOriginal.startsWith('http')) {
              $d(img).attr('src', dataOriginal);
            }
          });

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
            source: 'IT之家',
            sourceId: 'ithome',
            imageUrl,
            images,
            publishedAt: $d('#pubtime_ba498, .post_time, [class*="time"]').first().text().trim() || undefined,
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
