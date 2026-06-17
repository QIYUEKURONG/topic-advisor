import { fetch } from 'undici';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', '..', 'data', 'images');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function urlToFilename(url: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const ext = guessExtension(url);
  return `${hash}${ext}`;
}

function guessExtension(url: string): string {
  const cleaned = url.split('?')[0].split('#')[0];
  if (cleaned.endsWith('.png')) return '.png';
  if (cleaned.endsWith('.gif')) return '.gif';
  if (cleaned.endsWith('.webp')) return '.webp';
  return '.jpg';
}

export async function downloadImage(imageUrl: string, taskId: string): Promise<string | null> {
  try {
    const dir = join(IMAGES_DIR, taskId);
    ensureDir(dir);

    const filename = urlToFilename(imageUrl);
    const filepath = join(dir, filename);

    if (existsSync(filepath)) return filepath;

    const resp = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'image/*,*/*;q=0.8',
        Referer: new URL(imageUrl).origin,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok || !resp.body) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 1000) return null;

    writeFileSync(filepath, buffer);
    return filepath;
  } catch {
    return null;
  }
}

export async function downloadArticleImages(
  content: string,
  taskId: string,
): Promise<Map<string, string>> {
  const urlToLocal = new Map<string, string>();
  const imgRegex = /\[IMG:(.+?)\]/g;
  let match: RegExpExecArray | null;

  const urls: string[] = [];
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  for (const url of urls) {
    const localPath = await downloadImage(url, taskId);
    if (localPath) {
      urlToLocal.set(url, localPath);
    }
  }

  return urlToLocal;
}

export function getTaskImageDir(taskId: string): string {
  return join(IMAGES_DIR, taskId);
}

export function listLocalImages(taskId: string): string[] {
  const dir = join(IMAGES_DIR, taskId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => join(dir, f));
}
