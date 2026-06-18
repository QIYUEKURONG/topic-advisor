import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const huxiu: CrawlerAdapter = {
  id: 'huxiu',
  name: '虎嗅',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.huxiu.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string; thumb?: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('/article/') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.title === text)
        ) {
          const fullUrl = href.startsWith('http') ? href : `https://www.huxiu.com${href}`;
          const img = $(el).closest('[class*="card"], [class*="item"], [class*="article"]').find('img').first();
          const thumbSrc = img.attr('src') || img.attr('data-src') || '';
          links.push({
            url: fullUrl,
            title: text,
            thumb: thumbSrc && thumbSrc.startsWith('http') ? thumbSrc : undefined,
          });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.article__content, .article-content, #article_content, .text-content';
          const content = extractContentWithImages($d, selector);
          let imageUrl = extractFirstImage($d, selector) || link.thumb;
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
            source: '虎嗅',
            sourceId: 'huxiu',
            imageUrl: imageUrl || images[0],
            images,
            publishedAt: $d('.article-time, time, .pub-time').first().text().trim() || undefined,
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
