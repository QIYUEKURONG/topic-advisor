import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const qbitai: CrawlerAdapter = {
  id: 'qbitai',
  name: '量子位',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.qbitai.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string; imageUrl?: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const img = $(el).closest('article, [class*="post"], [class*="item"]').find('img').first();
        const imgSrc = img.attr('src') || img.attr('data-src') || '';

        if (
          href.includes('qbitai.com/') &&
          (href.match(/\/\d{4}\/\d{2}\//) || href.includes('/category/')) &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href || l.title === text)
        ) {
          const fullUrl = href.startsWith('/') ? `https://www.qbitai.com${href}` : href;
          links.push({
            url: fullUrl,
            title: text,
            imageUrl: imgSrc && imgSrc.length > 10 ? (imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc) : undefined,
          });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.entry-content, .post-content, .article-content, article, .content';
          const content = extractContentWithImages($d, selector);
          let imageUrl = link.imageUrl || extractFirstImage($d, selector);
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
            source: '量子位',
            sourceId: 'qbitai',
            imageUrl,
            images,
            publishedAt: $d('.entry-date, .post-date, [class*="time"], time').first().text().trim() || undefined,
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
