import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const sinaSociety: CrawlerAdapter = {
  id: 'sina-society',
  name: '新浪社会',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://news.sina.com.cn/society/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('sina.com.cn') &&
          href.includes('/doc-') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href)
        ) {
          links.push({ url: href, title: text });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '#article, .article-content-left, .article';
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
            source: '新浪社会',
            sourceId: 'sina-society',
            imageUrl: imageUrl || images[0],
            images,
            publishedAt: $d('.date, .pub_date, .article-time').first().text().trim() || undefined,
          });
        } catch {
          // skip individual article errors
        }
      }
    } catch {
      // source-level failure
    }

    return articles;
  },
};
