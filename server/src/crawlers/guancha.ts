import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const guancha: CrawlerAdapter = {
  id: 'guancha',
  name: '观察者网',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.guancha.cn/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string; thumb?: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          (href.includes('guancha.cn/') && (href.includes('.shtml') || href.includes('/article/'))) &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href || l.title === text)
        ) {
          const fullUrl = href.startsWith('http') ? href : `https://www.guancha.cn${href}`;
          const img = $(el).closest('li, .item, .news-item').find('img').first();
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

          const selector = '.all-txt, .article-txt, .content-all, .article-content';
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
            source: '观察者网',
            sourceId: 'guancha',
            imageUrl: imageUrl || images[0],
            images,
            publishedAt: $d('.time, .pub_date, .article-time').first().text().trim() || undefined,
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
