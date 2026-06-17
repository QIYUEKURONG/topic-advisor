import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const neteaseNews: CrawlerAdapter = {
  id: 'netease-news',
  name: '网易新闻',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://news.163.com/domestic/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          (href.includes('163.com') || href.includes('news.163.com')) &&
          (href.includes('/article/') || href.endsWith('.html')) &&
          text.length > 8 &&
          text.length < 100 &&
          !href.includes('#') &&
          !links.some((l) => l.url === href)
        ) {
          links.push({ url: href.startsWith('//') ? `https:${href}` : href, title: text });
        }
      });

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '#content, .post_body, .post_text, .article-body';
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
            source: '网易新闻',
            sourceId: 'netease-news',
            imageUrl,
            images,
            publishedAt: $d('.post_info, .pub_time, .article-sub').first().text().trim() || undefined,
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
