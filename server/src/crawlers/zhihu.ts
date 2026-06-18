import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

export const zhihuHot: CrawlerAdapter = {
  id: 'zhihu-hot',
  name: '知乎热榜',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://www.zhihu.com/hot');
      const $ = parseWithCheerio(html);

      const links: { url: string; title: string; excerpt: string; image?: string }[] = [];

      $('.HotList-item, .HotItem').each((_, el) => {
        const titleEl = $(el).find('.HotList-itemTitle, .HotItem-title');
        const title = titleEl.text().trim();
        const linkEl = $(el).find('a').first();
        const href = linkEl.attr('href') || '';
        const excerpt = $(el).find('.HotList-itemExcerpt, .HotItem-excerpt').text().trim();
        const img = $(el).find('img').first().attr('src') || '';

        if (title.length > 4 && href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
          links.push({
            url: fullUrl,
            title,
            excerpt,
            image: img && img.startsWith('http') ? img : undefined,
          });
        }
      });

      if (links.length === 0) {
        $('a[href*="/question/"]').each((_, el) => {
          const text = $(el).text().trim();
          const href = $(el).attr('href') || '';
          if (text.length > 8 && text.length < 100 && !links.some((l) => l.title === text)) {
            const fullUrl = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
            links.push({ url: fullUrl, title: text, excerpt: '' });
          }
        });
      }

      for (const link of links.slice(0, limit)) {
        let content = link.excerpt || link.title;
        let imageUrl = link.image;
        let images: string[] = link.image ? [link.image] : [];

        try {
          const detailHtml = await fetchHTML(link.url);
          const $d = parseWithCheerio(detailHtml);

          const selector = '.RichContent-inner, .Post-RichText, .QuestionAnswer-content, .RichText';
          const extracted = extractContentWithImages($d, selector);
          if (extracted.length > content.length) content = extracted;

          const detailImg = extractFirstImage($d, selector);
          const detailImgs = extractAllImages($d, selector);
          if (detailImg) imageUrl = detailImg;
          if (detailImgs.length > 0) images = [...new Set([...images, ...detailImgs])];

          if (!imageUrl) {
            const ogImg = extractOgImage($d);
            if (ogImg) {
              imageUrl = ogImg;
              images.push(ogImg);
            }
          }
        } catch {
          // use excerpt
        }

        articles.push({
          title: link.title,
          content: cleanText(content),
          url: link.url,
          source: '知乎热榜',
          sourceId: 'zhihu-hot',
          imageUrl,
          images,
        });
      }
    } catch {
      // source failure
    }

    return articles;
  },
};
