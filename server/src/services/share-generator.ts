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
    ? `这是一个 GitHub 开源项目。文章必须包含以下几个板块（按顺序）：

**板块1 — 痛点共鸣**：先描述一个普通人（学生/上班族/创业者/自媒体人）在日常工作中遇到的具体痛苦场景。让读者一读就觉得"这说的不就是我吗？"。然后引出这个项目如何解决这个问题。

**板块2 — 它是什么**：用一句话定义 + 一个生活比喻解释核心原理。不要罗列功能，要解释"它的本质是什么"。

**板块3 — 日常生活实战场景**（最重要！至少占全文30%）：
列举 4-5 个贴近真实生活的使用场景，每个场景必须是：
- 谁（具体的人物角色，如"大三计算机专业学生小陈"）
- 遇到什么问题（具体的日常困境）
- 怎么用这个工具解决的（步骤描述，像教朋友一样说）
- 效果对比（用之前 vs 用之后）
场景要涵盖不同人群：学生、职场打工人、自媒体创作者、小团队创业者等。

**板块4 — 怎么开始用**：像教爸妈用新手机一样，一步步说清楚怎么上手。不要贴代码，用"第一步...第二步..."这种方式。

**板块5 — 和替代方案对比**：它和同类工具/传统方式相比好在哪里？不好在哪里？客观评价。

**板块6 — 适合谁、不适合谁**：明确说出什么人最应该试试，什么人可能用不上。`
    : scraped.urlType === 'paper'
    ? `这是一篇学术论文/研究。文章必须包含以下板块：

**板块1 — 生活引入**：先讲一个普通人生活中能感知到的现象/问题，然后说"有一群科学家专门研究了这个"。

**板块2 — 研究了什么**：用大白话说清楚研究问题，像给初中生解释一样。

**板块3 — 发现了什么**：核心结论用生活场景类比，比如"就好像你发现每天多走1000步，半年后体重就能减5斤"这种直觉式表达。

**板块4 — 对我们的日常生活有什么影响**（最重要！）：
列举 3-4 个具体场景，说明这个研究结论如何影响普通人的决策、行为或认知。比如：买东西时、学习时、工作中、人际关系中。

**板块5 — 局限和争议**：这项研究有什么局限？不能过度解读的地方。

**板块6 — 一句话总结**：如果要转述给朋友听，一句话怎么说？`
    : `这是一篇网络文章。文章必须包含以下板块：

**板块1 — 场景代入**：描述一个读者可能正在经历的场景，引出文章话题。

**板块2 — 核心观点提炼**：用最简单的语言说清楚文章的核心信息。

**板块3 — 对普通人的实际影响**（最重要！）：
列举 3-5 个具体场景，说明这个信息/观点如何影响读者的日常生活、消费决策、职业发展等。

**板块4 — 不同视角分析**：正反两面客观分析。

**板块5 — 读者行动指南**：基于文章内容，读者现在可以做什么？`;

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
- sections 必须有 6-8 个，严格按照上面的板块顺序覆盖
- "日常生活实战场景"或"对普通人的实际影响"板块可以拆成多个 section
- 每个 section 的 body 至少300字，要有实质内容
- body 中要用 **加粗** 强调关键概念和数据
- 场景描述必须具体到人名、职业、具体困境，让读者有代入感
- 多用"就像…一样"、"你有没有遇到过…"这类读者能共鸣的表达
- 不要空洞的赞美，每个优点都要用具体场景证明
- 明确说出局限和不适用的情况，保持客观
- comicHint 要够具体，有人物、有动作、有场景对比
- tags 至少5个，覆盖领域、功能、受众
- 重要：JSON 字符串中的双引号必须用 \\" 转义，换行用 \\n`,
    config,
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 未返回有效 JSON');

  let jsonStr = jsonMatch[0];
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    jsonStr = jsonStr
      .replace(/[\x00-\x1f]/g, (c) => c === '\n' ? '\\n' : c === '\t' ? '\\t' : '')
      .replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e2) {
      const sectionsMatch = jsonStr.match(/"sections"\s*:\s*\[([\s\S]*)\]/);
      if (!sectionsMatch) throw new Error('AI 返回的 JSON 解析失败，请重试');
      const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]+)"/);
      const hookMatch = jsonStr.match(/"hook"\s*:\s*"([^"]+)"/);
      const conclusionMatch = jsonStr.match(/"conclusion"\s*:\s*"([^"]+)"/);
      const headings = [...jsonStr.matchAll(/"heading"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
      const bodies = [...jsonStr.matchAll(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
      const hints = [...jsonStr.matchAll(/"comicHint"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
      parsed = {
        title: titleMatch?.[1] || '',
        hook: hookMatch?.[1] || '',
        sections: headings.map((h, i) => ({ heading: h, body: bodies[i] || '', comicHint: hints[i] || '' })),
        conclusion: conclusionMatch?.[1] || '',
        tags: [],
      };
    }
  }
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
