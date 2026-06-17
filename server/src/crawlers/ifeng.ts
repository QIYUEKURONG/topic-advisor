import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const ifengNews: CrawlerAdapter = {
  id: 'ifeng-news',
  name: '凤凰网资讯',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://news.ifeng.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('ifeng.com') &&
          (href.includes('/c/') || href.includes('/article/')) &&
          text.length > 8 &&
          text.length < 100 &&
          !href.includes('#') &&
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

          const selector = '#artical_real, .index_text_EY, .main_content-GR, [class*="article_content"], [class*="text_"]';
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
            source: '凤凰网资讯',
            sourceId: 'ifeng-news',
            imageUrl: imageUrl || images[0],
            images,
            publishedAt: $d('[class*="time"], [class*="date"], .index_source').first().text().trim() || undefined,
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
