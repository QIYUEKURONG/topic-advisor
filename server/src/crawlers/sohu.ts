import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const sohuEnt: CrawlerAdapter = {
  id: 'sohu-ent',
  name: '搜狐娱乐',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.sohu.com/c/8/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const fullUrl = href.startsWith('//') ? `https:${href}` : href.startsWith('/a/') ? `https://www.sohu.com${href}` : href;

        if (
          fullUrl.includes('sohu.com') &&
          fullUrl.includes('/a/') &&
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

          const selector = '#mp-editor, .article-content, article';
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
            source: '搜狐娱乐',
            sourceId: 'sohu-ent',
            imageUrl,
            images,
            publishedAt: $d('.article-info, .time, [class*="time"]').first().text().trim() || undefined,
          });
        } catch {
          // skip
        }
      }
    } catch {
      // source-level failure
    }

    return articles;
  },
};
