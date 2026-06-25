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

const STYLE_PERSONAS: Record<string, string> = {
  popular: `你是一位有自己风格的科技博主，文字像跟朋友聊天，不像在写论文。你的特点：
1. 说人话——把技术翻译成普通人能懂的语言，但不要居高临下地"科普"
2. 有态度——敢说不好的地方，不是每句都在夸
3. 真实感——会说"说实话我一开始也没看懂"这种话，偶尔会跑题
4. 不啰嗦——说完就走，不要反复强调同一个观点

禁止使用AI味道重的表达：不要"在当今XX时代"、"不仅XX更XX"、"无论是XX还是XX"开头。写得像真人，不像模板。

目标受众：对科技/知识感兴趣但非专业人士的社交平台读者。`,

  deep: `你是一位资深技术评论员，擅长撰写深度技术分析文章。你的特点是：
1. 对技术原理有深刻理解，能解释底层机制
2. 善用架构图思维——从系统设计角度分析
3. 引用具体的技术指标和性能数据
4. 与其他技术方案做横向深度对比

目标受众：有一定技术背景的工程师和技术决策者。`,

  humor: `你是一个超级有趣的科技段子手博主，粉丝100万+。你的风格是：
1. 用搞笑的比喻解释严肃的技术——"这玩意儿就像给你家猫装了个翻译器"
2. 善用吐槽和自嘲——让读者笑出声
3. 在搞笑中不丢干货——笑完之后发现真学到东西了
4. 大量使用口语化表达——就像跟朋友在聊天

目标受众：喜欢轻松阅读、讨厌枯燥教程的年轻读者。`,

  xiaohongshu: `你是一个小红书TOP博主，专注科技种草和工具安利。你的风格是：
1. 开头就是"姐妹们/兄弟们！这个工具绝了！"
2. 大量使用感叹号和emoji语感（但输出纯文本）
3. 重点突出"亲测有效""真的好用""后悔没早发现"
4. 列出具体的使用场景和前后对比
5. 结尾配一个"赶紧收藏！"

目标受众：社交媒体用户，追求实用推荐。`,

  news: `你是一位专业的科技记者，在主流媒体工作。你的风格是：
1. 客观中立——用事实和数据说话，不夹带主观情绪
2. 5W1H结构——who/what/when/where/why/how
3. 引用权威来源和具体数据
4. 简洁有力——每句话都有信息量
5. 适当引用行业专家的观点或评价

目标受众：关注行业动态的专业读者。`,
};

interface StructureTemplate {
  name: string;
  guide: string;
}

const GITHUB_TEMPLATES: StructureTemplate[] = [
  {
    name: '介绍型',
    guide: `这是一个 GitHub 开源项目。用"先说痛点再说方案"的方式写：

**板块1 — 痛点共鸣**：先描述一个普通人在日常工作中遇到的具体痛苦场景。让读者觉得"这不就是我吗"。然后引出这个项目。

**板块2 — 它是什么**：一句话定义 + 生活比喻解释核心原理。不罗列功能，说清"本质是什么"。

**板块3 — 实际使用场景**（最多3个场景，挑最有代表性的）：
每个场景说清楚谁、遇到什么问题、怎么用它解决的、前后对比。

**板块4 — 怎么上手**：像教朋友用新工具一样说清步骤，不要贴代码。

**板块5 — 适合谁、不适合谁**：客观说清楚，包括局限。`,
  },
  {
    name: '故事型',
    guide: `这是一个 GitHub 开源项目。用一个完整的故事串起来，像写小说一样带读者经历一遍：

**板块1 — 故事开头**：虚构一个具体的人（有名字、职业、背景），描述他/她正被某个问题困扰。让读者产生代入感。

**板块2 — 发现解药**：这个人偶然发现了这个项目，描述初次使用的感受——疑惑、尝试、惊喜。

**板块3 — 实际体验**：用2-3个具体的使用片段展开，写得像日记一样真实。有成功也可以有小挫折。

**板块4 — 回头看变化**：用之前和用之后的生活/工作状态对比。不要夸大。

**板块5 — 给读者的话**：以主人公视角给出建议——什么人适合用、要注意什么。`,
  },
  {
    name: 'QA对谈型',
    guide: `这是一个 GitHub 开源项目。用"一问一答"的采访形式写，就像在跟项目作者（或者重度用户）聊天。

每个 section 的 heading 是一个问题，body 是回答。要自然，像真人对话一样有停顿和跑题。

建议的问题方向（按顺序来，4-5个问题就够了）：
- "一句话说说这是个啥？"
- "你为什么做这个 / 什么时候开始用这个？"
- "日常怎么用的？举个例子？"（最多2个例子）
- "有什么坑或者不好的地方吗？"
- "推荐什么人来用？"

回答风格要口语化，可以有"emmm"、"怎么说呢"这种犹豫的表达。`,
  },
  {
    name: '清单型',
    guide: `这是一个 GitHub 开源项目。用短平快的清单/要点方式写，适合快速浏览：

**板块1 — 一句话说清它是什么**：不啰嗦，一两句话搞定。

**板块2 — 核心亮点**：列3-4个最打动人的特点，每个2-3句话。不要面面俱到，挑最值得说的。

**板块3 — 上手指南**：3步以内说清怎么开始用。

**板块4 — 优缺点清单**：各列2-3个，要具体，不要"功能强大"这种空话。

**板块5 — 适用场景**：什么时候用它最爽，什么时候别折腾了。

每段都要短，读者扫一眼就能抓到重点。`,
  },
  {
    name: '对比评测型',
    guide: `这是一个 GitHub 开源项目。以"对比"为主线来写，帮读者搞清楚"我应该用它还是用别的"：

**板块1 — 为什么要对比**：简单说明有哪些同类方案，读者面临什么选择困难。

**板块2 — 这个项目是什么**：快速介绍核心定位。

**板块3 — 和传统方式/竞品对比**：选2-3个维度（比如上手难度、功能覆盖、性能、社区活跃度）做直接对比。要客观，不要一边倒。

**板块4 — 适用场景对比**：什么情况下选这个，什么情况下选别的。给出具体的决策建议。

**板块5 — 我的建议**：站在一个老用户的角度，给不同需求的读者直接的推荐。`,
  },
  {
    name: '问题解决型',
    guide: `这是一个 GitHub 开源项目。围绕"一个问题从头到尾怎么解决"来展开：

**板块1 — 问题描述**：把一个很多人都会遇到的具体问题说清楚。要能引起读者"对对对我也是"的反应。

**板块2 — 常见的错误解法**：大家通常怎么应对？为什么效果不好？（1-2个就行）

**板块3 — 这个工具的解法**：它怎么从根本上解决这个问题。不要罗列功能，说清解题思路。

**板块4 — 实际效果**：用1-2个真实场景展示效果。前后对比要有画面感。

**板块5 — 上手建议和注意事项**：怎么开始，有什么坑要避开。`,
  },
  {
    name: '探索发现型',
    guide: `这是一个 GitHub 开源项目。用"我偶然发现了一个宝藏"的视角来写，像分享一个私人收藏：

**板块1 — 怎么发现的**：随意地说说你是在什么情况下碰到这个项目的。可以说是刷GitHub、看别人推荐、或者为了解决某个问题搜到的。

**板块2 — 第一印象**：刚看到时的感受。可以先吐槽README写得不够好，或者表达初次使用的惊艳。要真实。

**板块3 — 深入使用后的感受**：用了一段时间后的真实评价。好的地方和不够好的地方都说。最多3个具体的使用片段。

**板块4 — 值不值得收藏**：总结性地说说这个项目在你的工具箱里是什么位置，使用频率如何。

**板块5 — 推荐指数**：给不同类型的人打个分（如：开发者 8/10，普通用户 5/10），附简短理由。`,
  },
];

const PAPER_TEMPLATES: StructureTemplate[] = [
  {
    name: '科普型',
    guide: `这是一篇学术论文/研究。用科普的方式写，让普通人也能看懂：

**板块1 — 生活引入**：先讲一个普通人生活中能感知到的现象/问题，然后说"有人专门研究了这个"。

**板块2 — 研究了什么**：用大白话说清楚研究问题。

**板块3 — 发现了什么**：核心结论用生活场景类比来解释。

**板块4 — 对普通人的影响**（最多3个场景）：这个结论怎么影响我们的日常决策和行为。

**板块5 — 局限和注意**：不能过度解读的地方。`,
  },
  {
    name: '故事型',
    guide: `这是一篇学术论文/研究。用故事化的方式讲述研究过程：

**板块1 — 起因**：研究者为什么要研究这个？背后有什么有趣的故事或观察？

**板块2 — 探索过程**：像讲探案故事一样，说说他们怎么设计实验、怎么收集数据的。

**板块3 — 发现真相**：结果出来了！用有画面感的方式描述核心发现。

**板块4 — 这跟我有什么关系**：2-3个具体场景说明对普通人的意义。

**板块5 — 悬而未决**：还有什么问题没解决？未来可能往哪走？`,
  },
  {
    name: '争议讨论型',
    guide: `这是一篇学术论文/研究。用"这个结论引发了争议"的角度切入：

**板块1 — 抛出争议**：这个研究的结论可能颠覆了某个常识，或者和流行观点冲突。先把争议感拉满。

**板块2 — 研究说了什么**：客观描述核心发现。

**板块3 — 支持方怎么看**：哪些证据支持这个结论。

**板块4 — 反对方怎么看**：哪些质疑和局限。

**板块5 — 普通人怎么办**：在争议没有定论之前，我们应该怎么理解和应对。`,
  },
];

const ARTICLE_TEMPLATES: StructureTemplate[] = [
  {
    name: '提炼型',
    guide: `这是一篇网络文章。用提炼核心观点的方式重新组织：

**板块1 — 场景代入**：描述一个读者可能正在经历的场景，引出话题。

**板块2 — 核心观点**：用最简单的语言说清文章的核心信息。

**板块3 — 对普通人的影响**（最多3个场景）：具体说明这个信息怎么影响读者的日常生活。

**板块4 — 不同视角**：正反两面客观分析。

**板块5 — 行动指南**：读者现在可以做什么？`,
  },
  {
    name: '吐槽点评型',
    guide: `这是一篇网络文章。用一个真实读者的视角来"点评"这篇文章：

**板块1 — 这篇文章讲了啥**：快速过一遍核心内容，像跟朋友转述一样。

**板块2 — 说得对的部分**：哪些观点确实有道理，举1-2个自己的经历印证。

**板块3 — 存疑的部分**：哪些地方感觉不太靠谱，或者有其他可能性。

**板块4 — 补充和延伸**：文章没提到但相关的重要信息。

**板块5 — 我的结论**：读完之后的个人态度，推不推荐别人也读。`,
  },
  {
    name: 'QA型',
    guide: `这是一篇网络文章。用自问自答的方式重新组织内容：

每个 section 的 heading 是一个读者可能想问的问题，body 是回答。

建议的问题方向（4-5个就够了）：
- "这篇文章到底在说什么？"
- "这跟我有什么关系？"
- "真的是这样吗？有没有反例？"
- "如果我想行动，该怎么做？"
- "还有什么需要注意的？"

回答要简洁直接，像真人在回答一样。`,
  },
];

function pickStructureTemplate(urlType: string): string {
  const templates = urlType === 'github' ? GITHUB_TEMPLATES
    : urlType === 'paper' ? PAPER_TEMPLATES
    : ARTICLE_TEMPLATES;
  const picked = templates[Math.floor(Math.random() * templates.length)];
  return picked.guide;
}

async function generateShareArticle(
  scraped: ScrapedContent,
  config: AIProviderConfig,
  articleStyle: string = 'popular',
): Promise<ShareArticle> {
  const metaLines = Object.entries(scraped.meta)
    .filter(([, v]) => v !== '' && v !== 0 && v !== 'N/A')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const contentPreview = scraped.body.length > 8000
    ? scraped.body.slice(0, 8000) + '\n...(内容已截断)'
    : scraped.body;

  const typeGuide = pickStructureTemplate(scraped.urlType);

  const persona = STYLE_PERSONAS[articleStyle] || STYLE_PERSONAS.popular;

  const result = await callTextAI(
    persona,

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
- sections 必须有 4-6 个，按照上面的板块顺序覆盖
- 场景最多3个，不要贪多，挑最有代表性的
- 每个 section 的 body 200-400字，言之有物但不啰嗦
- body 中可以用 **加粗** 强调关键概念和数据，但不要滥用
- 场景描述要具体，但不要每个都用"小X"命名人物
- 明确说出局限和不适用的情况，保持客观
- comicHint 要够具体，有人物、有动作、有场景对比
- tags 至少5个，覆盖领域、功能、受众

去AI化要求（非常重要！）：
- 禁止使用以下AI味道重的句式："在当今...时代"、"不仅...更..."、"无论是...还是..."、"随着..."开头、"值得一提的是"、"总而言之"、"综上所述"、"不难发现"、"毋庸置疑"
- 禁止过度使用感叹号，全文最多3个感叹号
- 禁止空洞的夸赞，如"非常强大"、"极其出色"、"真的太好用了"
- 写法要像真人写的博客，不像AI生成的：有个人观点、有犹豫、有不确定、偶尔用口语
- 可以有"说实话"、"我个人觉得"、"不过话说回来"这类真人表达
- 段落长短要参差不齐，不要每段都差不多长
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
  articleStyle: string,
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
  const article = await generateShareArticle(scraped, aiConfig, articleStyle);
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
          fontScale: 1.0,
          leftColor: 'red',
          rightColor: 'lime',
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

const PLATFORM_FORMATTERS: Record<string, (share: GeneratedShare) => { content: string; ext: string }> = {
  markdown: (share) => {
    const { article, scraped } = share;
    const images = scraped.images || [];
    const lines: string[] = [`# ${article.title}`, '', `> ${article.hook}`, ''];
    const sectionCount = article.sections.length;
    const imgInterval = sectionCount > 0 && images.length > 0
      ? Math.max(1, Math.floor(sectionCount / images.length)) : 0;

    article.sections.forEach((sec, i) => {
      lines.push(`## ${sec.heading}`, '', sec.body, '');
      if (imgInterval > 0 && (i + 1) % imgInterval === 0) {
        const imgIdx = Math.floor((i + 1) / imgInterval) - 1;
        if (imgIdx < images.length) lines.push(`![${sec.heading}](${images[imgIdx]})`, '');
      }
    });
    lines.push('---', '', article.conclusion, '', article.tags.map(t => `#${t}`).join(' '),
      '', `项目地址：${share.url}`);
    return { content: lines.join('\n'), ext: 'md' };
  },

  toutiao: (share) => {
    const { article, scraped } = share;
    const images = scraped.images || [];
    const lines: string[] = [article.title, '', article.hook, ''];
    article.sections.forEach((sec, i) => {
      lines.push(`【${sec.heading}】`, '', sec.body, '');
      if (i < images.length) lines.push(`[图片: ${images[i]}]`, '');
    });
    lines.push('', article.conclusion, '', article.tags.map(t => `#${t}`).join(' '),
      '', `项目地址：${share.url}`);
    return { content: lines.join('\n'), ext: 'txt' };
  },

  wechat: (share) => {
    const { article, scraped } = share;
    const images = scraped.images || [];
    const lines: string[] = [
      `# ${article.title}`, '',
      `> ${article.hook}`, '',
    ];
    article.sections.forEach((sec, i) => {
      lines.push(`## ${sec.heading}`, '', sec.body, '');
      if (i < images.length) lines.push(`![](${images[i]})`, '');
    });
    lines.push('', `**${article.conclusion}**`, '', article.tags.map(t => `#${t}`).join(' '),
      '', '---', `原文链接：${share.url}`);
    return { content: lines.join('\n'), ext: 'md' };
  },

  xiaohongshu: (share) => {
    const { article } = share;
    const lines: string[] = [
      article.title + ' ‼️', '',
      article.hook, '',
    ];
    article.sections.forEach(sec => {
      lines.push(`📌 ${sec.heading}`, '', sec.body, '');
    });
    lines.push('', `💡 ${article.conclusion}`, '', article.tags.map(t => `#${t}`).join(' '),
      '', `🔗 ${share.url}`);
    return { content: lines.join('\n'), ext: 'txt' };
  },

  zhihu: (share) => {
    const { article, scraped } = share;
    const images = scraped.images || [];
    const lines: string[] = [`# ${article.title}`, '', `> ${article.hook}`, ''];
    article.sections.forEach((sec, i) => {
      lines.push(`## ${sec.heading}`, '', sec.body, '');
      if (i < images.length) lines.push(`![](${images[i]})`, '');
    });
    lines.push('', '---', '', article.conclusion, '', article.tags.map(t => `#${t}`).join(' '),
      '', `> 来源：${share.url}`);
    return { content: lines.join('\n'), ext: 'md' };
  },

  douyin: (share) => {
    const { article } = share;
    const lines: string[] = [
      `🔥 ${article.title}`, '',
      article.hook, '',
    ];
    article.sections.forEach(sec => {
      lines.push(`👉 ${sec.heading}`, sec.body, '');
    });
    lines.push(`✅ ${article.conclusion}`, '', article.tags.map(t => `#${t}`).join(' '),
      '', `🔗 ${share.url}`);
    return { content: lines.join('\n'), ext: 'txt' };
  },

  weibo: (share) => {
    const { article } = share;
    const sections = article.sections.map(s => `【${s.heading}】${s.body}`).join('\n\n');
    const text = `${article.title}\n\n${article.hook}\n\n${sections}\n\n${article.conclusion}\n\n${article.tags.map(t => `#${t}#`).join(' ')}\n\n🔗 ${share.url}`;
    return { content: text, ext: 'txt' };
  },
};

export function exportShare(share: GeneratedShare, platform: string = 'markdown'): string {
  const settings = getSettings();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const slug = share.article.title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);

  const exportDir = join(settings.outputDir, 'shares', timestamp);
  if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });

  const formatter = PLATFORM_FORMATTERS[platform] || PLATFORM_FORMATTERS.markdown;
  const { content, ext } = formatter(share);
  const filename = `${slug}.${ext}`;
  writeFileSync(join(exportDir, filename), content, 'utf-8');

  return exportDir;
}
