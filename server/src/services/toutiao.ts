import type { Browser, Cookie, Page } from 'puppeteer-core';

async function getPuppeteer() {
  try {
    return (await import('puppeteer-core')).default;
  } catch {
    throw new Error('Puppeteer is not available. This feature requires puppeteer-core installed.');
  }
}
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CandidateArticle } from '../types.js';
import { downloadArticleImages } from './image-downloader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const COOKIES_FILE = join(DATA_DIR, 'toutiao-cookies.json');

const MP_BASE = 'https://mp.toutiao.com';

interface ToutiaoStatus {
  loggedIn: boolean;
  username?: string;
  avatar?: string;
}

interface PublishResult {
  success: boolean;
  pgcId?: string;
  draftUrl?: string;
  error?: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadCookies(): Cookie[] | null {
  try {
    if (!existsSync(COOKIES_FILE)) return null;
    return JSON.parse(readFileSync(COOKIES_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCookies(cookies: Cookie[]) {
  ensureDataDir();
  writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
}

let activeBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (activeBrowser?.connected) return activeBrowser;

  const puppeteer = await getPuppeteer();
  activeBrowser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return activeBrowser;
}

async function closeBrowser() {
  if (activeBrowser) {
    try { await activeBrowser.close(); } catch {}
    activeBrowser = null;
  }
}

export const toutiaoService = {
  async login(): Promise<{ status: string }> {
    await closeBrowser();

    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.goto('https://sso.toutiao.com/login/?service=https://mp.toutiao.com&type=2', {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    return { status: 'browser_opened' };
  },

  async waitForLogin(timeoutMs = 120_000): Promise<ToutiaoStatus> {
    if (!activeBrowser?.connected) return { loggedIn: false };

    const pages = await activeBrowser.pages();
    const page = pages[pages.length - 1];

    try {
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        const url = page.url();
        if (url.includes('mp.toutiao.com') && !url.includes('sso.toutiao.com')) {
          const cookies = await page.cookies(
            'https://mp.toutiao.com',
            'https://sso.toutiao.com',
            'https://www.toutiao.com',
          );
          saveCookies(cookies);
          await closeBrowser();
          return this.checkStatus();
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return { loggedIn: false };
    } catch {
      return { loggedIn: false };
    }
  },

  async checkStatus(): Promise<ToutiaoStatus> {
    const cookies = loadCookies();
    if (!cookies || cookies.length === 0) return { loggedIn: false };

    try {
      const cookieStr = cookies
        .filter((c) => c.domain?.includes('toutiao.com'))
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      const resp = await fetch(`${MP_BASE}/mp/agw/media/get_media_info`, {
        headers: {
          Cookie: cookieStr,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Referer: MP_BASE,
        },
      });

      if (!resp.ok) return { loggedIn: false };
      const data = (await resp.json()) as any;

      if (data.data?.user?.id) {
        return {
          loggedIn: true,
          username: data.data.user.screen_name,
          avatar: data.data.user.https_avatar_url,
        };
      }
      return { loggedIn: false };
    } catch {
      return { loggedIn: false };
    }
  },

  async publishDraft(article: CandidateArticle): Promise<PublishResult> {
    const cookies = loadCookies();
    if (!cookies || cookies.length === 0) {
      return { success: false, error: '未登录头条，请先登录' };
    }

    const isVideo = !!(article.videoUrl || article.category === '视频');

    let browser: Browser | null = null;

    try {
      const puppeteer = await getPuppeteer();
      browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 900 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setCookie(...cookies);

      if (isVideo) {
        await page.goto(`${MP_BASE}/profile_v4/graphic/publish`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        await new Promise((r) => setTimeout(r, 3000));

        await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const text = (el as HTMLElement).textContent?.trim() || '';
            const childCount = el.children.length;
            if ((text.startsWith('发布文章') || text.startsWith('发文章')) && childCount < 5) {
              (el as HTMLElement).click();
              return;
            }
          }
        });

        await new Promise((r) => setTimeout(r, 1500));

        await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const text = (el as HTMLElement).textContent?.trim() || '';
            if (text === '视频' && el.children.length <= 2) {
              (el as HTMLElement).click();
              return;
            }
          }
        });

        await new Promise((r) => setTimeout(r, 3000));

        return {
          success: true,
          draftUrl: page.url(),
        };
      }

      await page.goto(`${MP_BASE}/profile_v4/graphic/publish`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      await new Promise((r) => setTimeout(r, 3000));

      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise((r) => setTimeout(r, 500));

      const titleOk = await fillTitle(page, article.title);
      if (!titleOk) {
        await browser.close();
        return { success: false, error: '无法找到标题输入框' };
      }

      await new Promise((r) => setTimeout(r, 1000));

      const fullContent = articleToPlainText(article);
      await fillContent(page, fullContent);

      await new Promise((r) => setTimeout(r, 1000));

      const imageMap = await downloadArticleImages(article.content, article.id);
      console.log(`[toutiao] Article "${article.title}" has ${imageMap.size} images downloaded`);
      if (imageMap.size > 0) {
        console.log(`[toutiao] Uploading images: ${[...imageMap.values()].join(', ')}`);
        await uploadImagesToEditor(page, [...imageMap.values()]);
      }

      await new Promise((r) => setTimeout(r, 2000));

      await page.evaluate(() => {
        const labels = document.querySelectorAll('label, span, div');
        for (const el of labels) {
          const text = (el as HTMLElement).textContent?.trim() || '';
          if (text === '无封面') {
            (el as HTMLElement).click();
            const radio = el.querySelector('input[type="radio"]') || el.previousElementSibling;
            if (radio && radio.tagName === 'INPUT') {
              (radio as HTMLInputElement).click();
            }
            break;
          }
        }

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
          const parent = cb.parentElement;
          if (parent && (parent.textContent || '').includes('头条首发') && (cb as HTMLInputElement).checked) {
            (cb as HTMLInputElement).click();
            break;
          }
        }

        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = (el as HTMLElement).textContent?.trim() || '';
          if (text === '头条首发' && el.previousElementSibling?.tagName === 'INPUT') {
            const checkbox = el.previousElementSibling as HTMLInputElement;
            if (checkbox.checked) checkbox.click();
            break;
          }
        }
      });

      await new Promise((r) => setTimeout(r, 1000));

      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyS');
      await page.keyboard.up('Meta');

      await new Promise((r) => setTimeout(r, 3000));

      const saveError = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = (el as HTMLElement).textContent?.trim() || '';
          if (text.includes('保存失败') || text.includes('保存成功') || text.includes('已保存')) {
            return text;
          }
        }
        return '';
      });

      if (saveError.includes('失败')) {
        const draftBtnClicked = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, [role="button"], [class*="btn"], [class*="Button"]');
          for (const btn of buttons) {
            const text = (btn as HTMLElement).textContent?.trim() || '';
            if (text.includes('存草稿') || text.includes('保存草稿')) {
              (btn as HTMLElement).click();
              return true;
            }
          }

          const allEls = document.querySelectorAll('span, div, a');
          for (const el of allEls) {
            const text = (el as HTMLElement).textContent?.trim() || '';
            if (text === '存草稿' || text === '保存草稿') {
              (el as HTMLElement).click();
              return true;
            }
          }
          return false;
        });

        if (draftBtnClicked) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      await new Promise((r) => setTimeout(r, 3000));

      const finalUrl = page.url();
      const pgcMatch = finalUrl.match(/pgc_id=(\d+)/);
      const pgcId = pgcMatch?.[1] && pgcMatch[1] !== '0' ? pgcMatch[1] : undefined;

      return {
        success: true,
        pgcId,
        draftUrl: pgcId
          ? `${MP_BASE}/profile_v4/graphic/publish?pgc_id=${pgcId}`
          : `${MP_BASE}/profile_v4/graphic/articles`,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async publishMultipleDrafts(
    articles: CandidateArticle[],
    onProgress?: (i: number, total: number, result: PublishResult) => void,
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (let i = 0; i < articles.length; i++) {
      try {
        const result = await this.publishDraft(articles[i]);
        results.push(result);
        onProgress?.(i + 1, articles.length, result);
      } catch (err) {
        const failResult: PublishResult = { success: false, error: String(err) };
        results.push(failResult);
        onProgress?.(i + 1, articles.length, failResult);
      }

      if (i < articles.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    return results;
  },

  clearCookies() {
    try {
      if (existsSync(COOKIES_FILE)) {
        writeFileSync(COOKIES_FILE, '[]');
      }
    } catch {}
  },
};

async function fillTitle(page: Page, title: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 2000));

  const clicked = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const ph = el.getAttribute('placeholder') || '';
      const dataPh = el.getAttribute('data-placeholder') || '';
      const combined = ph + dataPh;
      if (combined.includes('文章标题') || combined.includes('2～30') || combined.includes('2~30')) {
        (el as HTMLElement).click();
        (el as HTMLElement).focus();
        return true;
      }
    }

    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      const ph = ta.getAttribute('placeholder') || '';
      if (ph.includes('标题') || ph.includes('30')) {
        ta.focus();
        ta.click();
        return true;
      }
    }

    if (textareas.length > 0) {
      textareas[0].focus();
      textareas[0].click();
      return true;
    }

    return false;
  });

  if (clicked) {
    await new Promise((r) => setTimeout(r, 300));
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Meta');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.type(title.slice(0, 30), { delay: 30 });
    return true;
  }

  const selectors = [
    'textarea',
    '[data-placeholder*="标题"]',
    '[placeholder*="标题"]',
  ];

  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click({ count: 3 });
      await new Promise((r) => setTimeout(r, 200));
      await page.keyboard.press('Backspace');
      await new Promise((r) => setTimeout(r, 100));
      await page.keyboard.type(title.slice(0, 30), { delay: 30 });
      return true;
    }
  }

  return false;
}

async function fillContent(page: Page, text: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 500));

  const cleanLines = text.split('\n')
    .filter((l) => l.trim())
    .filter((l) => !l.startsWith('[IMG:'));

  const htmlContent = cleanLines
    .map((line) => `<p>${escapeHTML(line)}</p>`)
    .join('');

  const filled = await page.evaluate((html: string) => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const ph = el.getAttribute('placeholder') || '';
      const dataPh = el.getAttribute('data-placeholder') || '';
      const combined = ph + dataPh;
      if (combined.includes('正文') || combined.includes('输入正文')) {
        (el as HTMLElement).click();
        (el as HTMLElement).focus();
        document.execCommand('insertHTML', false, html);
        return true;
      }
    }

    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.height > 100 && rect.width > 300) {
        (el as HTMLElement).click();
        (el as HTMLElement).focus();
        document.execCommand('insertHTML', false, html);
        return true;
      }
    }

    return false;
  }, htmlContent);

  if (filled) return true;

  const editorSelectors = [
    '[contenteditable="true"]',
    '.ProseMirror',
    '.ql-editor',
    '[role="textbox"]',
  ];

  for (const sel of editorSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await new Promise((r) => setTimeout(r, 500));

      await page.evaluate((selector: string, html: string) => {
        const editor = document.querySelector(selector) as HTMLElement;
        if (editor) {
          editor.focus();
          document.execCommand('insertHTML', false, html);
        }
      }, sel, htmlContent);

      await new Promise((r) => setTimeout(r, 500));
      const hasContent = await page.evaluate((selector: string) => {
        const editor = document.querySelector(selector);
        return editor ? (editor as HTMLElement).textContent!.length > 10 : false;
      }, sel);

      if (hasContent) return true;
    }
  }

  return false;
}

function articleToPlainText(article: CandidateArticle): string {
  const lines: string[] = [];

  const imagePatterns = /^(图\/截图|图片来源|图片|截图|配图|来源：|图源|资料图|示意图|网络图片|图文无关|供图).*$/;

  const contentLines = article.content
    .split('\n')
    .filter((line) => line.trim())
    .filter((line) => !imagePatterns.test(line.trim()))
    .filter((line) => line.trim().length > 2);

  lines.push(...contentLines);
  lines.push('');
  lines.push(`本文转载自 ${article.source}，原文链接：${article.url}`);

  return lines.join('\n');
}

function articleToHTML(article: CandidateArticle): string {
  const paragraphs = article.content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHTML(line.trim())}</p>`)
    .join('');

  let imageHtml = '';
  if (article.imageUrl) {
    imageHtml = `<p><img src="${escapeHTML(article.imageUrl)}" /></p>`;
  }

  const sourceNote = `<p><br></p><p><em>本文转载自 ${escapeHTML(article.source)}，原文链接：<a href="${escapeHTML(article.url)}">${escapeHTML(article.url)}</a></em></p>`;

  return imageHtml + paragraphs + sourceNote;
}

async function uploadImagesToEditor(page: Page, localPaths: string[]): Promise<void> {
  for (const imgPath of localPaths) {
    try {
      const uploaded = await tryToolbarUpload(page, imgPath);
      if (uploaded) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const pasted = await pasteImageViaClipboard(page, imgPath);
      if (pasted) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      // skip this image
    }
  }
}

async function tryToolbarUpload(page: Page, imgPath: string): Promise<boolean> {
  const fileInputsBefore = await page.$$('input[type="file"]');

  const clicked = await page.evaluate(() => {
    const toolbar = document.querySelector('[class*="toolbar"], [class*="Toolbar"], [class*="editor-toolbar"], [class*="ql-toolbar"]');
    const searchIn = toolbar || document;

    const candidates = searchIn.querySelectorAll('button, [role="button"], span, div, i');
    for (const btn of candidates) {
      const el = btn as HTMLElement;
      const title = el.getAttribute('title') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const className = el.className || '';

      if (
        title.includes('图片') || title.includes('image') || title.includes('Image') ||
        ariaLabel.includes('图片') || ariaLabel.includes('image') ||
        /\bimage\b|\bimg\b|\bpicture\b/i.test(className)
      ) {
        el.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) return false;

  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = (el as HTMLElement).textContent?.trim() || '';
      if (text === '本地上传' || text === '上传图片' || text === '本地') {
        (el as HTMLElement).click();
        break;
      }
    }
  });

  await new Promise((r) => setTimeout(r, 1000));

  const fileInputsAfter = await page.$$('input[type="file"]');
  const fileInput = fileInputsAfter[fileInputsAfter.length - 1] || fileInputsBefore[fileInputsBefore.length - 1];

  if (fileInput) {
    await (fileInput as any).uploadFile(imgPath);
    await new Promise((r) => setTimeout(r, 4000));

    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [role="button"]');
      for (const btn of btns) {
        const text = (btn as HTMLElement).textContent?.trim() || '';
        if (text === '确定' || text === '插入' || text === '确认' || text === '完成') {
          (btn as HTMLElement).click();
          return;
        }
      }
    });

    await new Promise((r) => setTimeout(r, 1500));
    return true;
  }

  return false;
}

async function pasteImageViaClipboard(page: Page, imgPath: string): Promise<boolean> {
  const imgBuffer = readFileSync(imgPath);
  const base64 = imgBuffer.toString('base64');
  const ext = imgPath.split('.').pop() || 'jpeg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const result = await page.evaluate(
    (b64: string, mime: string) => {
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (!editor) return false;

      editor.focus();

      const byteChars = atob(b64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArr], { type: mime });
      const file = new File([blob], 'image.' + (mime === 'image/png' ? 'png' : 'jpg'), { type: mime });

      const dt = new DataTransfer();
      dt.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });

      editor.dispatchEvent(pasteEvent);
      return true;
    },
    base64,
    mimeType,
  );

  return result;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
