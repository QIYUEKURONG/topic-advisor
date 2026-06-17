import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage, cleanText } from './base.js';

export const jiqizhixin: CrawlerAdapter = {
  id: 'jiqizhixin',
  name: '机器之心',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.jiqizhixin.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string; imageUrl?: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const img = $(el).find('img').first();
        const imgSrc = img.attr('src') || img.attr('data-src') || '';

        if (
          (href.includes('/articles/') || href.includes('/daily/')) &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href)
        ) {
          const fullUrl = href.startsWith('/') ? `https://www.jiqizhixin.com${href}` : href;
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

          const selector = '.article-content, .article_content, .content, article';
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
            source: '机器之心',
            sourceId: 'jiqizhixin',
            imageUrl,
            images,
            publishedAt: $d('.article-time, [class*="time"], [class*="date"]').first().text().trim() || undefined,
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
