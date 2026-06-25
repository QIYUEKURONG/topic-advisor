import { fetch } from 'undici';
import type { UrlType, ScrapedContent } from '../types.js';

function detectUrlType(url: string): UrlType {
  if (/github\.com\/[\w.-]+\/[\w.-]+/.test(url)) return 'github';
  if (/arxiv\.org|doi\.org|scholar\.google|ieee\.org|acm\.org|springer\.com|nature\.com|science\.org/.test(url)) return 'paper';
  return 'article';
}

async function scrapeGitHub(url: string): Promise<ScrapedContent> {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
  if (!match) throw new Error('无效的 GitHub 地址');
  const [, owner, repo] = match;

  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = { 'User-Agent': 'TopicAdvisor/1.0' };

  const [repoResp, readmeResp] = await Promise.all([
    fetch(apiBase, { headers, signal: AbortSignal.timeout(15_000) }),
    fetch(`${apiBase}/readme`, { headers: { ...headers, Accept: 'application/vnd.github.v3.raw' }, signal: AbortSignal.timeout(15_000) }),
  ]);

  if (!repoResp.ok) throw new Error(`GitHub API 错误: ${repoResp.status}`);
  const repoData = (await repoResp.json()) as Record<string, any>;

  let readme = '';
  const images: string[] = [];
  if (readmeResp.ok) {
    readme = await readmeResp.text();

    const imgPatterns = [
      /!\[([^\]]*)\]\(([^)]+)\)/g,                              // ![alt](url)
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,                  // <img src="url">
    ];
    for (const pattern of imgPatterns) {
      for (const m of readme.matchAll(pattern)) {
        let imgUrl = pattern === imgPatterns[0] ? m[2] : m[1];
        if (!imgUrl) continue;
        if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
          // skip badges/shields
          if (/shields\.io|badge|\.svg(\?|$)/i.test(imgUrl)) continue;
          images.push(imgUrl);
        } else if (!imgUrl.startsWith('#') && !imgUrl.startsWith('data:')) {
          const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${repoData.default_branch || 'main'}`;
          images.push(`${rawBase}/${imgUrl.replace(/^\.?\//, '')}`);
        }
      }
    }

    if (readme.length > 15_000) readme = readme.slice(0, 15_000) + '\n\n... (内容已截断)';
  }

  return {
    urlType: 'github',
    url,
    title: repoData.full_name || `${owner}/${repo}`,
    description: repoData.description || '',
    body: readme,
    images: images.slice(0, 10),
    meta: {
      stars: repoData.stargazers_count || 0,
      forks: repoData.forks_count || 0,
      language: repoData.language || 'Unknown',
      topics: (repoData.topics || []).join(', '),
      license: repoData.license?.spdx_id || 'N/A',
      createdAt: repoData.created_at || '',
      updatedAt: repoData.pushed_at || '',
      openIssues: repoData.open_issues_count || 0,
    },
  };
}

async function scrapeWebPage(url: string, urlType: UrlType): Promise<ScrapedContent> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  });

  if (!resp.ok) throw new Error(`页面请求失败: ${resp.status}`);
  const html = await resp.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || url;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch?.[1]?.trim() || '';

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (body.length > 15_000) body = body.slice(0, 15_000) + ' ... (内容已截断)';

  const images: string[] = [];
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage?.[1]) images.push(ogImage[1]);
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    if (m[1] && m[1].startsWith('http') && images.length < 10) images.push(m[1]);
  }

  return { urlType, url, title, description, body, images: images.slice(0, 10), meta: {} };
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const urlType = detectUrlType(url);

  if (urlType === 'github') {
    return scrapeGitHub(url);
  }

  return scrapeWebPage(url, urlType);
}
