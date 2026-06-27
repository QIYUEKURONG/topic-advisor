import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText } from './base.js';

const SIDE_HUSTLE_NODES = [
  { node: 'share', label: '分享创造' },
  { node: 'career', label: '职场话题' },
  { node: 'freelance', label: '酷工作' },
  { node: 'create', label: '分享发现' },
];

const STRONG_KEYWORDS = [
  '副业', '兼职', '赚钱', '接单', '私活', '外快',
  '被动收入', '月入', '挣钱', '搞钱', 'freelance',
  '自由职业', '独立开发者',
];

const WEAK_KEYWORDS = [
  '变现', '外包', '远程', '创业', '做单',
  '个人项目', '盈利', '自媒体', '知识付费',
];

function matchesSideHustle(title: string, content: string): boolean {
  const text = (title + ' ' + content).toLowerCase();
  if (STRONG_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))) return true;
  const weakHits = WEAK_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
  return weakHits.length >= 2;
}

async function fetchV2exNode(node: string, limit: number): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];
  const url = `https://www.v2ex.com/go/${node}`;

  try {
    const html = await fetchHTML(url);
    const $ = parseWithCheerio(html);

    const items: { url: string; title: string }[] = [];
    $('#TopicsNode .cell .item_title a, .topic-link').each((_, el) => {
      const href = $(el).attr('href');
      const title = cleanText($(el).text());
      if (href && title) {
        const fullUrl = href.startsWith('http') ? href : `https://www.v2ex.com${href}`;
        items.push({ url: fullUrl.split('#')[0], title });
      }
    });

    for (const item of items.slice(0, limit * 2)) {
      try {
        const detailHtml = await fetchHTML(item.url);
        const $d = parseWithCheerio(detailHtml);

        const contentParts: string[] = [];
        $d('.topic_content .markdown_body p, .topic_content p, .topic_content').each((_, el) => {
          const text = cleanText($d(el).text());
          if (text.length > 5) contentParts.push(text);
        });

        const replies: string[] = [];
        $d('.reply_content').each((i, el) => {
          if (i >= 10) return;
          const text = cleanText($d(el).text());
          if (text.length > 10) replies.push(text);
        });

        const content = contentParts.join('\n');
        const fullText = content + '\n' + replies.join('\n');

        if (!matchesSideHustle(item.title, fullText)) continue;

        const article: RawArticle = {
          title: item.title,
          content: content + (replies.length > 0 ? '\n\n---\n热门回复:\n' + replies.join('\n\n') : ''),
          url: item.url,
          source: 'V2EX',
          sourceId: 'v2ex-sidehustle',
        };

        articles.push(article);
        if (articles.length >= limit) break;
      } catch {
        // skip failed detail page
      }
    }
  } catch {
    // skip failed node
  }

  return articles;
}

export const v2exSideHustle: CrawlerAdapter = {
  id: 'v2ex-sidehustle',
  name: 'V2EX副业',

  async fetchList(limit: number): Promise<RawArticle[]> {
    const allArticles: RawArticle[] = [];
    const seenUrls = new Set<string>();
    const perNode = Math.ceil(limit / SIDE_HUSTLE_NODES.length);

    for (const { node } of SIDE_HUSTLE_NODES) {
      try {
        const articles = await fetchV2exNode(node, perNode);
        for (const a of articles) {
          if (!seenUrls.has(a.url)) {
            seenUrls.add(a.url);
            allArticles.push(a);
          }
        }
      } catch {
        // skip failed node
      }
    }

    return allArticles.slice(0, limit);
  },
};
