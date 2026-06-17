import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';
import { fetch } from 'undici';

export const xiaohongshu: CrawlerAdapter = {
  id: 'xiaohongshu',
  name: '小红书热门',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const resp = await fetch('https://edith.xiaohongshu.com/api/sns/web/v1/homefeed', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Origin': 'https://www.xiaohongshu.com',
          'Referer': 'https://www.xiaohongshu.com/',
        },
        body: JSON.stringify({
          cursor_score: '',
          num: Math.min(limit, 40),
          refresh_type: 1,
          note_index: 0,
          unread_begin_note_id: '',
          unread_end_note_id: '',
          unread_note_count: 0,
          category: 'homefeed_recommend',
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as any;
        const items = data?.data?.items || [];

        for (const item of items.slice(0, limit)) {
          const note = item?.note_card;
          if (!note) continue;

          const title = note.display_title || note.title || '';
          const desc = note.desc || '';
          const noteId = note.note_id || item.id || '';

          if (title.length < 4) continue;

          const coverUrl = note.cover?.url || note.cover?.info_list?.[0]?.url;
          const noteImages: string[] = [];
          if (coverUrl) noteImages.push(coverUrl);
          if (note.images_list) {
            for (const img of note.images_list) {
              const imgUrl = img.url || img.info_list?.[0]?.url;
              if (imgUrl && !noteImages.includes(imgUrl)) noteImages.push(imgUrl);
            }
          }

          articles.push({
            title,
            content: desc || title,
            url: `https://www.xiaohongshu.com/explore/${noteId}`,
            source: '小红书',
            sourceId: 'xiaohongshu',
            imageUrl: coverUrl,
            images: noteImages,
          });
        }
      }

      if (articles.length === 0) {
        const html = await fetchHTML('https://www.xiaohongshu.com/explore');
        const $ = parseWithCheerio(html);

        const seen = new Set<string>();
        $('a[href*="/explore/"], a[href*="/discovery/item/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          const fullUrl = href.startsWith('/') ? `https://www.xiaohongshu.com${href}` : href;

          if (text.length > 4 && text.length < 100 && !seen.has(text)) {
            seen.add(text);
            articles.push({
              title: text,
              content: text,
              url: fullUrl,
              source: '小红书',
              sourceId: 'xiaohongshu',
            });
          }
        });

        if (articles.length === 0) {
          $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (
              text.length > 6 &&
              text.length < 80 &&
              href.includes('xiaohongshu') &&
              !seen.has(text)
            ) {
              seen.add(text);
              articles.push({
                title: text,
                content: text,
                url: href.startsWith('/') ? `https://www.xiaohongshu.com${href}` : href,
                source: '小红书',
                sourceId: 'xiaohongshu',
              });
            }
          });
        }
      }
    } catch {
      // source-level
    }

    return articles.slice(0, limit);
  },
};
