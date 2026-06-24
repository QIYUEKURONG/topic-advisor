import { fetch } from 'undici';
import { nanoid } from 'nanoid';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  ScrapedContent, ShareArticle, GeneratedShare,
  AIProviderConfig, StickerRequest, ImageConfig,
} from '../types.js';
import { getSettings } from '../config/settings.js';
import { scrapeUrl } from './content-scraper.js';
import { generateComic, type ProgressCallback } from './sticker-generator.js';

function getDataDir(): string {
  if (process.env.TOPIC_ADVISOR_DATA) return process.env.TOPIC_ADVISOR_DATA;
  if (process.env.NODE_ENV === 'production') return join(homedir(), '.topic-advisor');
  return join(process.cwd(), 'data');
}

function getSharesDir(): string {
  const dir = join(getDataDir(), 'shares');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function callTextAI(system: string, user: string, config: AIProviderConfig): Promise<string> {
  if (config.provider === 'claude') {
    const resp = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${await resp.text()}`);
    const data = (await resp.json()) as { content: Array<{ text: string }> };
    return data.content?.[0]?.text ?? '';
  }

  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!resp.ok) throw new Error(`Text AI ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

async function generateShareArticle(
  scraped: ScrapedContent,
  config: AIProviderConfig,
): Promise<ShareArticle> {
  const metaLines = Object.entries(scraped.meta)
    .filter(([, v]) => v !== '' && v !== 0 && v !== 'N/A')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const contentPreview = scraped.body.length > 8000
    ? scraped.body.slice(0, 8000) + '\n...(内容已截断)'
    : scraped.body;

  const typeGuide = scraped.urlType === 'github'
    ? `这是一个 GitHub 开源项目。请从以下维度深入介绍：
- 这个项目解决了什么痛点问题？没有它之前人们怎么做的？
- 核心功能和技术亮点是什么？用生活化的比喻解释原理
- 具体使用场景：什么人在什么情况下会用到它？举2-3个真实例子
- 怎么上手使用？简单描述安装和基本用法（不需要代码，用大白话描述步骤）
- 和同类工具相比有什么优势？社区生态如何？`
    : scraped.urlType === 'paper'
    ? `这是一篇学术论文/研究。请从以下维度深入解读：
- 这个研究到底在研究什么问题？为什么这个问题重要？
- 核心发现/结论是什么？用生活中的例子类比
- 这项研究用了什么方法？（不需要专业术语，类比解释）
- 这对我们普通人意味着什么？会怎样改变生活/行业？
- 这项研究的局限性和未来方向`
    : `这是一篇网络文章。请从以下维度深入解析：
- 文章的核心观点是什么？作者想传达什么信息？
- 背景知识：读者需要知道哪些前置信息才能理解？
- 关键论据和数据有哪些？它们说明了什么？
- 不同立场的人会怎么看这个问题？
- 这对读者有什么实际意义和启发？`;

  const result = await callTextAI(
    `你是一位顶级的科技自媒体博主，写过多篇10万+爆款文章。你的核心能力是：
1. 把复杂概念翻译成人话——善用比喻和生活场景类比
2. 内容有深度但不枯燥——每个观点都有例子支撑
3. 结构清晰有节奏——读者读完能完整复述给朋友听
4. 兼具科普和实用——不只是"这东西牛"，而是"你也能用得上"

目标受众：对科技/知识感兴趣但非专业人士的社交平台读者。`,

    `请根据以下内容，生成一篇深度图文分享文章。

${typeGuide}

**标题**: ${scraped.title}
**描述**: ${scraped.description}
${metaLines ? `**元信息**:\n${metaLines}` : ''}

**正文内容**:
${contentPreview}

请严格输出以下 JSON 格式（不要输出其他内容）：
{
  "title": "一个吸引人的标题（15-30字，不要用原标题，要体现文章的核心价值）",
  "hook": "开场白/引子（2-3句话，用一个具体场景或问题引入，让读者产生共鸣，80字以内）",
  "sections": [
    {
      "heading": "小标题（5-12字，有信息量）",
      "body": "这部分的正文内容（300-500字，要求：用具体例子解释概念，有数据或事实支撑，用比喻让抽象概念变得直观，段落之间有逻辑递进）",
      "comicHint": "这部分如果配漫画的话，画面应该是什么（20-35字描述，要具体到人物动作和场景，例如：一个上班族在杂乱的桌上手忙脚乱找文件 vs 同一个人用整理好的文件夹秒速找到文件）"
    }
  ],
  "conclusion": "总结（2-3句话：先总结核心价值，再给读者一个行动建议或思考方向）",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
}

严格要求：
- sections 必须有 5-7 个，全面覆盖上述维度
- 每个 section 的 body 至少300字，要有实质内容，不是简单概括
- body 中要用 **加粗** 强调关键概念和数据
- 多用生活化的比喻来解释技术概念（比如"就像…一样"）
- 要有具体的使用场景描述，让读者能代入自己
- 不要空洞的赞美，每个优点都要配合具体例子说明
- comicHint 要够具体，有人物、有动作、有场景对比
- tags 至少5个，覆盖领域、功能、受众`,
    config,
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 未返回有效 JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || scraped.title,
    hook: parsed.hook || '',
    sections: (parsed.sections || []).map((s: any) => ({
      heading: s.heading || '',
      body: s.body || '',
      comicHint: s.comicHint || '',
    })),
    conclusion: parsed.conclusion || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

export type ShareProgressCallback = (phase: string, detail: string, progress: number, total: number) => void;

export async function generateShare(
  url: string,
  enableComics: boolean,
  comicStyle: string,
  onProgress?: ShareProgressCallback,
): Promise<GeneratedShare> {
  const settings = getSettings();
  const aiConfig = settings.aiProvider;
  if (!aiConfig.apiKey) throw new Error('请先在设置中配置 AI 的 API Key');

  const shareId = nanoid(12);
  const shareDir = join(getSharesDir(), shareId);
  mkdirSync(shareDir, { recursive: true });

  const totalSteps = enableComics ? 4 : 2;
  let step = 0;

  onProgress?.('scrape', '正在抓取页面内容...', step, totalSteps);
  const scraped = await scrapeUrl(url);
  writeFileSync(join(shareDir, 'scraped.json'), JSON.stringify(scraped, null, 2));
  step++;

  onProgress?.('generate', 'AI 正在生成分享文章...', step, totalSteps);
  const article = await generateShareArticle(scraped, aiConfig);
  writeFileSync(join(shareDir, 'article.json'), JSON.stringify(article, null, 2));
  step++;

  let comicId: string | undefined;

  if (enableComics && settings.imageProvider?.apiKey) {
    onProgress?.('comics', '正在生成配套漫画...', step, totalSteps);

    const imageConfigs: ImageConfig[] = article.sections
      .filter(s => s.comicHint)
      .slice(0, 3)
      .map(s => ({
        mode: s.comicHint?.includes(' vs ') ? 'comparison' as const : 'normal' as const,
        hint: s.comicHint,
      }));

    if (imageConfigs.length > 0) {
      try {
        const stickerRequest: StickerRequest = {
          topic: article.title,
          style: (comicStyle || 'cute') as any,
          fontStyle: 'default',
          fontColor: 'white',
          textLayout: 'bar',
          imageCount: imageConfigs.length,
          imageConfigs,
        };
        const comic = await generateComic(stickerRequest, (phase, detail, p, t) => {
          onProgress?.('comics', `漫画: ${detail}`, step, totalSteps);
        });
        comicId = comic.id;
      } catch (err) {
        console.error('Comic generation failed (non-fatal):', err instanceof Error ? err.message : err);
      }
    }
    step++;
  }

  onProgress?.('done', '完成！', totalSteps, totalSteps);

  const share: GeneratedShare = {
    id: shareId,
    url,
    urlType: scraped.urlType,
    scraped,
    article,
    comicId,
    status: 'done',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(shareDir, 'share.json'), JSON.stringify(share, null, 2));
  return share;
}

export function listShares(): GeneratedShare[] {
  const dir = getSharesDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const p = join(dir, e.name, 'share.json');
      if (!existsSync(p)) return null;
      try { return JSON.parse(readFileSync(p, 'utf-8')) as GeneratedShare; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as GeneratedShare[];
}

export function getShare(id: string): GeneratedShare | null {
  const p = join(getSharesDir(), id, 'share.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}
