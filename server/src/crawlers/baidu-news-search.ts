import { fetch } from 'undici';
import type { CrawlerAdapter, RawArticle } from '../types.js';
import { fetchHTML, parseWithCheerio, cleanText, extractContentWithImages, extractFirstImage, extractAllImages, extractOgImage } from './base.js';

async function resolveRedirect(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
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

async function fetchDetailContent(url: string): Promise<{ content: string; imageUrl?: string; images: string[]; title?: string }> {
  const realUrl = url.includes('baidu.com/link') ? await resolveRedirect(url) : url;

  const html = await fetchHTML(realUrl);
  const $ = parseWithCheerio(html);

  $('script, style, iframe, noscript, nav, header, footer, [class*="comment"], [class*="recommend"], [class*="related"], [class*="sidebar"], [class*="share"], [class*="ad"]').remove();

  const selectors = [
    'article', '.article', '.article-content', '.article-body',
    '#content', '.content', '.post_body', '.post_text',
    '.main-content', '.detail-body', '.news-content',
    '[class*="article-content"]', '[class*="news_content"]',
    '[class*="content_"]', '[class*="detail"]',
    'main',
  ];

  let bestContent = '';
  let bestSelector = '';
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const text = extractContentWithImages($, sel);
    if (text.length > bestContent.length) {
      bestContent = text;
      bestSelector = sel;
    }
  }

  if (bestContent.length < 50) {
    const paragraphs: string[] = [];
    $('p').each((_, p) => {
      const text = $(p).text().trim();
      if (text.length > 20) paragraphs.push(text);
    });
    if (paragraphs.join('\n').length > bestContent.length) {
      bestContent = paragraphs.join('\n');
    }
  }

  let imageUrl = bestSelector
    ? extractFirstImage($, bestSelector)
    : undefined;
  const images = bestSelector
    ? extractAllImages($, bestSelector)
    : [];
  if (!imageUrl && images.length === 0) {
    const ogImg = extractOgImage($);
    if (ogImg) {
      imageUrl = ogImg;
      images.push(ogImg);
    }
  }

  const title = $('h1').first().text().trim() || $('[class*="title"]').first().text().trim();

  return { content: bestContent, imageUrl, images, title: title || undefined };
}

function createSearchCrawler(id: string, name: string, searchQuery: string): CrawlerAdapter {
  return {
    id,
    name,

    async fetchList(limit: number): Promise<RawArticle[]> {
      const articles: RawArticle[] = [];
      const encodedQuery = encodeURIComponent(searchQuery);
      const url = `https://www.baidu.com/s?tn=news&rtt=4&bsst=1&cl=2&wd=${encodedQuery}`;

      try {
        const html = await fetchHTML(url);
        const $ = parseWithCheerio(html);

        const items: { url: string; title: string; desc: string; source?: string; time?: string; thumbUrl?: string }[] = [];

        $('.result, [class*="result"]').each((_, el) => {
          const titleEl = $(el).find('h3 a, .news-title a, [class*="title"] a').first();
          const href = titleEl.attr('href') || '';
          const title = cleanText(titleEl.text());
          const desc = cleanText($(el).find('.c-summary, .c-abstract, [class*="summary"], [class*="abstract"], [class*="content"], p').text());
          let sourceInfo = $(el).find('.c-author, .news-source, [class*="source"]').text().trim();
          const srcWords = sourceInfo.split(/\s+/);
          if (srcWords.length === 2 && srcWords[0] === srcWords[1]) sourceInfo = srcWords[0];
          const thumbImg = $(el).find('img').first();
          const thumbSrc = thumbImg.attr('src') || thumbImg.attr('data-src') || '';
          const thumbUrl = thumbSrc && thumbSrc.startsWith('http') && thumbSrc.length > 20
            ? thumbSrc : undefined;

          if (title.length > 4 && title.length < 120 && href && !items.some((i) => i.title === title)) {
            items.push({ url: href, title, desc, source: sourceInfo || undefined, thumbUrl });
          }
        });

        for (const item of items.slice(0, limit)) {
          let content = item.desc || item.title;
          let imageUrl: string | undefined;
          let images: string[] = [];

          try {
            const detail = await fetchDetailContent(item.url);
            if (detail.content.length > content.length) {
              content = detail.content;
            }
            imageUrl = detail.imageUrl;
            images = detail.images;
            if (detail.title && detail.title.length > item.title.length && detail.title.length < 120) {
              item.title = detail.title;
            }
          } catch {
            // detail fetch failed, use search snippet
          }

          if (!imageUrl && item.thumbUrl) {
            imageUrl = item.thumbUrl;
            if (!images.includes(item.thumbUrl)) images.push(item.thumbUrl);
          }

          articles.push({
            title: item.title,
            content,
            url: item.url,
            source: item.source || name,
            sourceId: id,
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
}

function createMultiQuerySearchCrawler(
  id: string,
  name: string,
  searchQueries: string[],
): CrawlerAdapter {
  const singleCrawlers = searchQueries.map((q, i) =>
    createSearchCrawler(`${id}-${i}`, name, q),
  );

  return {
    id,
    name,
    async fetchList(limit: number): Promise<RawArticle[]> {
      const perQuery = Math.ceil(limit / singleCrawlers.length);
      const allArticles: RawArticle[] = [];
      const seenTitles = new Set<string>();

      for (const crawler of singleCrawlers) {
        try {
          const articles = await crawler.fetchList(perQuery);
          for (const a of articles) {
            const normTitle = a.title.replace(/\s+/g, '').toLowerCase();
            if (!seenTitles.has(normTitle)) {
              seenTitles.add(normTitle);
              a.sourceId = id;
              allArticles.push(a);
            }
          }
        } catch {
          // skip failed query
        }
      }

      return allArticles.slice(0, limit);
    },
  };
}

export const baiduAISearch = createMultiQuerySearchCrawler(
  'baidu-ai-search',
  '百度AI资讯',
  [
    'AI 人工智能 大模型 最新',
    'ChatGPT DeepSeek OpenAI',
    '人工智能 芯片 机器人',
  ],
);

export const baiduInvestSearch = createMultiQuerySearchCrawler(
  'baidu-invest-search',
  '百度投资快讯',
  [
    '融资 IPO 上市 最新',
    '投资 独角兽 创业公司',
    'A股 港股 财报 利润',
  ],
);

export const baiduEntSearch = createMultiQuerySearchCrawler(
  'baidu-ent-search',
  '百度娱乐资讯',
  [
    '明星 娱乐 八卦 热搜',
    '综艺 电影 电视剧 新片',
    '偶像 塌房 恋情 官宣',
  ],
);

export const baiduSportsSearch = createMultiQuerySearchCrawler(
  'baidu-sports-search',
  '百度体育资讯',
  [
    '足球 篮球 NBA CBA',
    '世界杯 欧冠 英超 西甲',
    '奥运会 冠军 运动员 赛事',
  ],
);

export const baiduHealthSearch = createMultiQuerySearchCrawler(
  'baidu-health-search',
  '百度健康养生',
  [
    '养生 健康 饮食 保健',
    '减肥 健身 睡眠 中医',
    '医院 医疗 疫苗 药品',
  ],
);

export const baiduTechSearch = createMultiQuerySearchCrawler(
  'baidu-tech-search',
  '百度科技数码',
  [
    '手机 新品 发布会 评测',
    '苹果 华为 小米 三星',
    '数码 耳机 电脑 显卡',
  ],
);

export const baiduCarSearch = createMultiQuerySearchCrawler(
  'baidu-car-search',
  '百度汽车资讯',
  [
    '新能源汽车 电动车 特斯拉 比亚迪',
    '新车 上市 降价 油价',
    '自动驾驶 智能座舱 车展',
  ],
);

export const baiduEduSearch = createMultiQuerySearchCrawler(
  'baidu-edu-search',
  '百度教育资讯',
  [
    '高考 考研 公务员 考试',
    '教育 学校 招生 分数线',
    '留学 培训 就业 毕业',
  ],
);

export const baiduFoodSearch = createMultiQuerySearchCrawler(
  'baidu-food-search',
  '百度美食资讯',
  [
    '美食 做法 食谱 教程',
    '餐饮 网红店 打卡 探店',
    '食品安全 315 外卖',
  ],
);

export const baiduHouseSearch = createMultiQuerySearchCrawler(
  'baidu-house-search',
  '百度房产资讯',
  [
    '房价 楼市 买房 政策',
    '房贷 利率 限购 放松',
    '二手房 新房 装修',
  ],
);

export const baiduPsychSearch = createMultiQuerySearchCrawler(
  'baidu-psych-search',
  '百度心理学资讯',
  [
    '心理学 心理健康 情绪管理',
    '焦虑症 抑郁症 心理咨询 治疗',
    '人格 性格 心理测试 认知',
  ],
);

export const baiduSideHustleSearch = createMultiQuerySearchCrawler(
  'baidu-sidehustle-search',
  '百度副业赚钱',
  [
    '程序员副业 接私活 实操经验分享',
    '普通人副业 月入过千 真实经历',
    '远程接单 自由职业者 一天工作',
    '独立开发者 产品上线 收入公开',
  ],
);
