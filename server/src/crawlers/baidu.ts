import { fetch } from 'undici';
import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

async function resolveBaiduLink(url: string): Promise<string> {
  if (!url.includes('baidu.com/link') && !url.includes('top.baidu.com')) return url;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8_000),
    });
    return resp.url || url;
  } catch {
    return url;
  }
}

export const baiduHot: CrawlerAdapter = {
  id: 'baidu-hot',
  name: '百度热搜',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://top.baidu.com/board?tab=realtime');
      const $ = parseWithCheerio(html);

      const items: { url: string; title: string; desc: string; imageUrl?: string }[] = [];

      $('[class*="category-wrap"] a, [class*="list_"] a, .c-single-text-ellipsis').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).find('[class*="title"], .c-single-text-ellipsis').text().trim() || $(el).text().trim();
        const desc = $(el).closest('[class*="content"]').find('[class*="desc"]').text().trim();
        const img = $(el).closest('[class*="content"]').find('img').first();
        const imgSrc = img.attr('src') || img.attr('data-src') || '';

        const junkTitles = /查看更多|查看全部|展开全部|加载更多|点击查看|下一页|上一页|返回/;
        if (title.length > 4 && title.length < 100 && !junkTitles.test(title) && !items.some((l) => l.title === title)) {
          items.push({
            url: href.startsWith('http') ? href : `https://top.baidu.com${href}`,
            title,
            desc,
            imageUrl: imgSrc && imgSrc.length > 10 && !imgSrc.includes('data:image')
              ? (imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc)
              : undefined,
          });
        }
      });

      if (items.length === 0) {
        $('a').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          if (
            text.length > 6 &&
            text.length < 80 &&
            (href.includes('baidu.com') || href.startsWith('/')) &&
            !text.includes('百度') &&
            !/查看更多|查看全部|展开|加载更多|点击查看|下一页|上一页|返回/.test(text) &&
            !items.some((l) => l.title === text)
          ) {
            items.push({
              url: href.startsWith('http') ? href : `https://top.baidu.com${href}`,
              title: text,
              desc: '',
            });
          }
        });
      }

      for (const item of items.slice(0, limit)) {
        let content = item.desc || '';
        let imageUrl = item.imageUrl;
        const images: string[] = imageUrl ? [imageUrl] : [];

        const resolvedUrl = await resolveBaiduLink(item.url);
        if (resolvedUrl.startsWith('http') && !resolvedUrl.includes('top.baidu.com/board')) {
          try {
            const detailHtml = await fetchHTML(resolvedUrl);
            const $d = parseWithCheerio(detailHtml);
            const detailContent = extractContentWithImages($d, 'article, .article, .main-content, #content, .detail-body, [class*="article"], [class*="content"]');
            if (detailContent.length > content.length) {
              content = detailContent;
            }
            if (!imageUrl) {
              imageUrl = extractFirstImage($d, 'article, .article, .main-content, #content, .detail-body, [class*="article"], [class*="content"]');
            }
            const detailImages = extractAllImages($d, 'article, .article, .main-content, #content, .detail-body, [class*="article"], [class*="content"]');
            for (const img of detailImages) {
              if (!images.includes(img)) images.push(img);
            }
            if (!imageUrl && images.length === 0) {
              const ogImg = extractOgImage($d);
              if (ogImg) {
                imageUrl = ogImg;
                images.push(ogImg);
              }
            }
          } catch {
            // detail fetch failed, use what we have
          }
        }

        if (!content) content = item.title;

        articles.push({
          title: item.title,
          content,
          url: item.url,
          source: '百度热搜',
          sourceId: 'baidu-hot',
          imageUrl,
          images,
        });
      }
    } catch {
      // source-level
    }

    return articles;
  },
};
