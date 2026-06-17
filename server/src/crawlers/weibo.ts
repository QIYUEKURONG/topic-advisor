import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

export const weiboHot: CrawlerAdapter = {
  id: 'weibo-hot',
  name: '微博热搜',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const html = await fetchHTML('https://s.weibo.com/top/summary');
      const $ = parseWithCheerio(html);

      const items: { title: string; url: string; hot?: string }[] = [];

      $('td.td-02 a').each((_, el) => {
        const title = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const hot = $(el).closest('tr').find('td.td-02 span').text().trim();

        if (title && href && title.length > 2) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://s.weibo.com${href}`;
          items.push({ title, url: fullUrl, hot });
        }
      });

      for (const item of items.slice(0, limit)) {
        let content = '';
        let imageUrl: string | undefined;
        const images: string[] = [];

        try {
          const searchHtml = await fetchHTML(item.url);
          const $s = parseWithCheerio(searchHtml);

          const topContents: string[] = [];
          $s('[class*="card-wrap"], [class*="card_wrap"]').slice(0, 5).each((_, card) => {
            const text = $s(card).find('[class*="txt"], [class*="content"]').text().trim();
            if (text.length > 10) topContents.push(cleanText(text));

            $s(card).find('img').each((__, img) => {
              const src = $s(img).attr('src') || $s(img).attr('data-src') || '';
              if (
                src &&
                src.length > 10 &&
                !src.includes('data:image') &&
                !src.includes('.gif') &&
                !src.includes('icon') &&
                !src.includes('avatar') &&
                !src.includes('emoticon') &&
                (src.includes('sinaimg') || src.includes('weibocdn'))
              ) {
                const fullSrc = src.startsWith('//') ? `https:${src}` : src;
                const hqSrc = fullSrc.replace('/orj360/', '/large/').replace('/thumb150/', '/large/').replace('/thumb180/', '/large/');
                if (!images.includes(hqSrc)) images.push(hqSrc);
              }
            });
          });

          if (topContents.length > 0) {
            content = topContents.join('\n\n');
          }
          if (images.length > 0) {
            imageUrl = images[0];
          }
        } catch {
          // search page fetch failed
        }

        if (!content) {
          content = item.hot
            ? `热度: ${item.hot}\n\n该话题正在微博热搜榜上，点击链接查看完整讨论。`
            : '该话题正在微博热搜榜上。';
        }

        articles.push({
          title: item.title,
          content,
          url: item.url,
          source: '微博热搜',
          sourceId: 'weibo-hot',
          category: '社会',
          imageUrl,
          images,
        });
      }
    } catch {
      // source-level failure
    }

    return articles;
  },
};
