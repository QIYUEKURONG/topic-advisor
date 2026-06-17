import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import type { RawArticle } from '../types.js';

export async function fetchHTML(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }

  return await resp.text();
}

export function parseWithCheerio(html: string) {
  return cheerio.load(html);
}

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractContent($: cheerio.CheerioAPI, selector: string): string {
  const el = $(selector).first();
  if (!el.length) return '';

  el.find('script, style, iframe, noscript, svg, [class*="comment"], [class*="recommend"], [class*="related"], [class*="share"], [class*="ad-"], .ad, .advertisement').remove();

  const paragraphs: string[] = [];
  el.find('p').each((_, p) => {
    const text = $(p).text().trim();
    if (text.length > 0) paragraphs.push(text);
  });

  if (paragraphs.length > 3) {
    return paragraphs.join('\n');
  }

  return cleanText(el.text());
}

export function extractContentWithImages($: cheerio.CheerioAPI, selector: string): string {
  const el = $(selector).first();
  if (!el.length) return '';

  el.find('script, style, iframe, noscript, svg, link, meta, [class*="comment"], [class*="recommend"], [class*="related"], [class*="share"], [class*="ad-"], [class*="tie-"], [id*="tie-"], .ad, .advertisement, .post_recommend, .post_jubao').remove();

  const parts: string[] = [];

  el.find('p, img, h2, h3, h4').each((_, node) => {
    if (node.type === 'tag' && node.name === 'img') {
      const src = $(node).attr('src') || $(node).attr('data-src') || $(node).attr('data-original') || '';
      if (isValidImageUrl(src)) {
        const fullSrc = src.startsWith('//') ? `https:${src}` : src;
        parts.push(`[IMG:${fullSrc}]`);
      }
    } else {
      const text = $(node).text().trim();
      if (text.length > 0 && !looksLikeCode(text)) {
        parts.push(text);
      }
    }
  });

  if (parts.length > 3) {
    return parts.join('\n');
  }

  el.find('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original') || '';
    if (isValidImageUrl(src)) {
      const fullSrc = src.startsWith('//') ? `https:${src}` : src;
      parts.push(`[IMG:${fullSrc}]`);
    }
  });

  const textContent = cleanText(el.text());
  const cleaned = textContent.split('\n').filter((l) => !looksLikeCode(l)).join('\n');
  return parts.length > 0 ? cleaned + '\n' + parts.filter(p => p.startsWith('[IMG:')).join('\n') : cleaned;
}

function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /document\.(createElement|getElementById|querySelector|body|execCommand)/,
    /function\s*\(/,
    /var\s+\w+\s*=/,
    /window\.\w+/,
    /\.js['";]/,
    /\.src\s*=/,
    /initWatchman/,
    /onload:/,
    /onerror/,
    /appendChild/,
    /Tie\.init/,
    /cdn\w*Path/i,
    /loadMessage/,
    /productNumber/,
    /isShowComments/,
  ];
  return codePatterns.some((p) => p.test(text));
}

function isValidImageUrl(src: string): boolean {
  if (!src || src.length < 10) return false;
  if (src.includes('data:image')) return false;
  const normalized = src.startsWith('//') ? `https:${src}` : src;
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

export function extractFirstImage($: cheerio.CheerioAPI, selector: string): string | undefined {
  const el = $(selector).first();
  if (!el.length) return undefined;

  let found: string | undefined;
  el.find('img').each((_, img) => {
    if (found) return;
    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original') || '';
    if (!isValidImageUrl(src)) return;

    const width = parseInt($(img).attr('width') || '0', 10);
    const height = parseInt($(img).attr('height') || '0', 10);
    if ((width > 0 && width < 30) || (height > 0 && height < 30)) return;

    found = src.startsWith('//') ? `https:${src}` : src;
  });

  return found;
}

export function extractArticle(
  $: cheerio.CheerioAPI,
  contentSelector: string,
  titleSelector?: string,
): Pick<RawArticle, 'title' | 'content'> {
  const title = titleSelector ? $(titleSelector).first().text().trim() : '';
  const content = extractContent($, contentSelector);
  return { title, content };
}

const JUNK_IMAGE_PATTERNS = [
  /data:image/,
  /\.gif$/i,
  /icon/i,
  /logo/i,
  /avatar/i,
  /favicon/i,
  /head\.jpg/i,
  /head\.png/i,
  /badge/i,
  /loading/i,
  /placeholder/i,
  /spinner/i,
  /arrow/i,
  /blank\./i,
  /transparent\./i,
  /1x1/,
  /pixel/i,
  /tracking/i,
  /analytics/i,
  /beacon/i,
  /advert/i,
  /banner_ad/i,
  /qrcode/i,
  /二维码/,
  /weixin.*\.jpg/i,
  /wechat.*\.jpg/i,
  /share_icon/i,
  /share-icon/i,
  /comment_icon/i,
];

function isJunkImage(src: string): boolean {
  return JUNK_IMAGE_PATTERNS.some((p) => p.test(src));
}

export function extractAllImages($: cheerio.CheerioAPI, selector: string): string[] {
  const images: string[] = [];
  const el = $(selector).first();
  if (!el.length) return images;

  el.find('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original') || '';
    if (!isValidImageUrl(src)) return;

    const width = parseInt($(img).attr('width') || '0', 10);
    const height = parseInt($(img).attr('height') || '0', 10);
    if ((width > 0 && width < 30) || (height > 0 && height < 30)) return;

    const fullSrc = src.startsWith('//') ? `https:${src}` : src;
    if (!images.includes(fullSrc)) images.push(fullSrc);
  });

  return images;
}

export function extractOgImage($: cheerio.CheerioAPI): string | undefined {
  const ogImg = $('meta[property="og:image"]').attr('content')
    || $('meta[name="twitter:image"]').attr('content')
    || $('meta[name="thumbnail"]').attr('content')
    || '';
  if (ogImg && ogImg.length > 10 && !isJunkImage(ogImg)) {
    return ogImg.startsWith('//') ? `https:${ogImg}` : ogImg;
  }
  return undefined;
}

export function extractImagesFromContent(content: string): string[] {
  const images: string[] = [];
  const regex = /\[IMG:([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!images.includes(match[1])) images.push(match[1]);
  }
  return images;
}
