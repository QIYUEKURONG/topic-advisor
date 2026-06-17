import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const tencentNews: CrawlerAdapter = {
  id: 'tencent-news',
  name: '腾讯新闻',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://news.qq.com/');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string }[] = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          href.includes('new.qq.com') &&
          href.includes('/rain/a/') &&
          text.length > 8 &&
          text.length < 100 &&
          !links.some((l) => l.url === href)
        ) {
          links.push({ url: href.startsWith('//') ? `https:${href}` : href, title: text });
        }
      });

      if (links.length === 0) {
        $('a').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          if (
            (href.includes('qq.com') && (href.includes('/omn/') || href.includes('/a/'))) &&
            text.length > 8 &&
            text.length < 100 &&
            !href.includes('#') &&
            !links.some((l) => l.url === href)
          ) {
            const fullUrl = href.startsWith('//') ? `https:${href}` : href;
            links.push({ url: fullUrl, title: text });
          }
        });
      }

      for (const link of links.slice(0, limit)) {
        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.content-article, .Cnt-Main-Article-QQ, #ArticleContent, .article-content, [class*="content_"]';
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
            source: '腾讯新闻',
            sourceId: 'tencent-news',
            imageUrl,
            images,
            publishedAt: $d('[class*="time"], [class*="date"], .a_time').first().text().trim() || undefined,
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
