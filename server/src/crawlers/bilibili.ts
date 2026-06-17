import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';
import { fetch } from 'undici';

export const bilibiliHot: CrawlerAdapter = {
  id: 'bilibili-hot',
  name: 'B站热门',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    try {
      const resp = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as any;

      if (data.code !== 0 || !data.data?.list) {
        throw new Error('Invalid response from Bilibili API');
      }

      for (const item of data.data.list.slice(0, limit)) {
        const title = item.title || '';
        const desc = item.desc || '';
        const bvid = item.bvid || '';
        const owner = item.owner?.name || '未知UP主';
        const stat = item.stat || {};

        if (title.length < 5) continue;

        const content = [
          desc,
          '',
          `UP主: ${owner}`,
          `播放量: ${formatNumber(stat.view)}`,
          `弹幕数: ${formatNumber(stat.danmaku)}`,
          `评论数: ${formatNumber(stat.reply)}`,
          `点赞数: ${formatNumber(stat.like)}`,
        ].join('\n');

        const coverUrl = item.pic || undefined;
        articles.push({
          title,
          content: cleanText(content || title),
          url: `https://www.bilibili.com/video/${bvid}`,
          source: 'B站热门',
          sourceId: 'bilibili-hot',
          videoUrl: `https://www.bilibili.com/video/${bvid}`,
          imageUrl: coverUrl,
          images: coverUrl ? [coverUrl] : [],
          category: '视频',
          publishedAt: item.pubdate ? new Date(item.pubdate * 1000).toLocaleString('zh-CN') : undefined,
        });
      }
    } catch {
      // source-level failure
    }

    return articles;
  },
};

function formatNumber(n: number | undefined): string {
  if (!n) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}
