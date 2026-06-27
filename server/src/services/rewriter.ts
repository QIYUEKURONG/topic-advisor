import { fetch } from 'undici';
import type { CandidateArticle, Settings, AIProviderConfig } from '../types.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

function getEffectiveAIConfig(settings: Settings): AIProviderConfig {
  if (settings.aiProvider?.apiKey) {
    return settings.aiProvider;
  }
  if (settings.deepseekApiKey) {
    return {
      provider: 'deepseek',
      apiKey: settings.deepseekApiKey,
      baseUrl: settings.deepseekBaseUrl || 'https://api.deepseek.com',
      model: 'deepseek-chat',
    };
  }
  throw new Error('AI API key not configured — go to Settings to set up your AI provider');
}

async function callChatAPI(
  messages: ChatMessage[],
  config: AIProviderConfig,
): Promise<string> {
  if (config.provider === 'claude') {
    return callClaudeAPI(messages, config);
  }

  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${config.provider} API error ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as ChatCompletionResponse;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callClaudeAPI(
  messages: ChatMessage[],
  config: AIProviderConfig,
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
  const userMsgs = messages.filter((m) => m.role !== 'system');

  const resp = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemMsg,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as { content: Array<{ text: string }> };
  return data.content?.[0]?.text ?? '';
}

function stripImages(content: string): string {
  return content.replace(/\[IMG:[^\]]+\]/g, '').trim();
}

const SIDE_HUSTLE_SOURCES = ['v2ex-sidehustle', 'baidu-sidehustle-search', 'zhihu-sidehustle', 'xhs-sidehustle'];

const AI_BLACKLIST_PHRASES = [
  '在当今', '在这个', '随着.*的发展', '不仅.*更.*', '值得一提的是',
  '总而言之', '综上所述', '总的来说', '一言以蔽之',
  '不可否认', '毋庸置疑', '无疑', '显而易见',
  '具有重要意义', '发挥着重要作用', '扮演着重要角色',
  '令人印象深刻', '引人注目', '令人瞩目', '令人惊叹',
  '提供了.*的可能', '带来了.*的机遇', '开辟了.*的道路',
  '需要注意的是', '众所周知', '不言而喻',
  '强烈推荐', '太好用了', '太厉害了', '太棒了',
  '宝藏', '干货满满', '建议收藏', '赶紧收藏',
  '让我们一起', '让我们来看看', '接下来让我们',
  '首先.*其次.*最后', '第一.*第二.*第三',
];

const DEAI_RULES = `
【写出人味 — 最高优先级】

你不是AI，你是一个真人在写东西给朋友看。

■ 禁用词（出现即不合格）：
${AI_BLACKLIST_PHRASES.map(p => `× "${p}"`).join('\n')}

■ 人味怎么来：
1. 说废话。真人说话会有"嗯"、"就是"、"反正吧"这种词。不要每句话都很精炼
2. 有态度。别客观中立，要有偏向："我觉得这玩意挺好用"比"这是一个很好的工具"有人味一万倍
3. 有情绪。可以兴奋、可以吐槽、可以无语、可以后悔。"说实话我当时看到这个价格差点没绷住"
4. 有缺陷。真人写东西会跑题一句再拉回来，会突然想到什么补一嘴。不要每段逻辑都那么完美
5. 有细节。别说"效果很好"，要说具体的："用了两周，确实比之前那个XX快了不少"
6. 会转折。"不过话说回来"、"但也不是没问题"、"emm这个就见仁见智了"

■ 硬性约束：
- 短句为主，一句话别超过25个字
- 全文最多2个感叹号
- 不要排比句
- 段落不超过3句
- 开头不要用"在当今/随着/近年来"
- 不要"首先其次最后"，用"先说X / 然后是Y / 最后聊聊Z"
`;

const SIDE_HUSTLE_SYSTEM_PROMPT = `你就是一个普通打工人，下班后搞过副业，有赚到过也踩过坑。你现在在微信群里跟朋友们聊这个话题。

注意：你不是在"分享经验"，你是在"聊天"。区别在于——
- 分享经验：条理清晰、结构完整、像教程
- 聊天：想到哪说到哪、会吐槽、会跑题一句再拉回来、会说"哦对了还有个事"

${DEAI_RULES}

**怎么写：**
开头随便聊几句引出话题（不要"大家好今天给大家分享"这种，太假了）。然后说说这个副业是啥、自己怎么做的、赚了多少（别吹，说真实的）、花了多少时间、遇到啥坑。

**最重要的部分：说真话**。
- "说实话前两个月基本没赚到什么钱"
- "这个方法不适合所有人，你得会XX才行"
- "中间差点放弃了，因为..."
- "网上很多人说月入过万，我觉得纯属扯淡，普通人能做到3000-5000就不错了"

**排版：**
- 加粗标记关键信息
- 段落短
- 600-1000字

**标题：**
- 像跟朋友说话：" 做了3个月副业，说说真实感受"、"靠XX每月多赚2000，但代价是..."
- 15-25字`;

const GENERAL_DEAI_PROMPT = `你是一个写了很多年的自媒体博主，有自己的风格。你写东西像在跟读者聊天，不像在播新闻。

${DEAI_RULES}

**你是这样写东西的：**
- 一上来不铺垫，直接说重点："这事挺有意思的"、"你们肯定没注意到..."
- 敢说自己的看法："我觉得"、"在我看来"、"说句可能会被喷的"
- 喜欢用类比："就好比你..."、"这就跟XX一样"
- 偶尔吐槽："说真的这操作我看不懂"、"属实是给我整无语了"
- 会承认自己不懂的地方："这块我也不太确定"、"懂行的朋友可以补充"

**排版：**
- **加粗** 标记重点
- 段落短，手机看着舒服
- 800-1500字

**标题：**
- 跟原标题完全不一样
- 有吸引力但不是标题党
- 15-30字`;

function isSideHustleArticle(article: CandidateArticle): boolean {
  return SIDE_HUSTLE_SOURCES.includes(article.sourceId);
}

function deAIPostProcess(text: string): string {
  let result = text;
  const replacements: [RegExp, string][] = [
    [/在当今[^\n。，]*时代[，,]/g, ''],
    [/随着[^\n。]*的(不断)?发展[，,]/g, ''],
    [/值得一提的是[，,]?/g, ''],
    [/总而言之[，,]?/g, '说到底，'],
    [/综上所述[，,]?/g, '总之，'],
    [/总的来说[，,]?/g, '反正，'],
    [/不可否认[，,]?/g, '确实，'],
    [/毋庸置疑[，,]?/g, ''],
    [/众所周知[，,]?/g, ''],
    [/显而易见[，,]?/g, ''],
    [/不言而喻[，,]?/g, ''],
    [/需要注意的是[，,]?/g, '有一点，'],
    [/具有重要意义/g, '挺重要'],
    [/发挥着重要作用/g, '很关键'],
    [/扮演着重要角色/g, '很关键'],
    [/令人印象深刻/g, '印象挺深'],
    [/引人注目/g, '挺显眼'],
    [/令人瞩目/g, '挺亮眼'],
    [/令人惊叹/g, '确实厉害'],
    [/提供了[^\n。，]*的可能/g, '让这个有了可能'],
    [/不仅([^\n。，]*)更([^\n。，]*)/g, '$1而且$2'],
    [/无论是([^\n。，]*)还是([^\n。，]*)/g, '$1也好$2也好'],
    [/让我们一起/g, '咱们'],
    [/让我们来看看/g, '来看看'],
    [/接下来让我们/g, '接着'],
    [/强烈推荐/g, '推荐'],
    [/太好用了/g, '挺好用'],
    [/太厉害了/g, '挺厉害'],
    [/太棒了/g, '不错'],
    [/干货满满/g, '挺实在'],
    [/建议收藏/g, '可以存着'],
    [/赶紧收藏/g, '存着备用'],
    [/！{2,}/g, '！'],
    [/!{2,}/g, '!'],
    [/。\n首先/g, '。\n先说'],
    [/。\n其次/g, '。\n然后是'],
    [/。\n最后/g, '。\n最后聊聊'],
  ];
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function buildRewritePrompt(article: CandidateArticle, settings: Settings): ChatMessage[] {
  const cleanContent = stripImages(article.content);

  const systemPrompt = isSideHustleArticle(article)
    ? SIDE_HUSTLE_SYSTEM_PROMPT
    : (settings.rewritePrompt + '\n\n' + DEAI_RULES);

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: [
        `【原文标题】${article.title}`,
        `【来源】${article.source}`,
        article.publishedAt ? `【发布时间】${article.publishedAt}` : '',
        `【原文内容】`,
        cleanContent,
        '',
        `⚠️ 重要：新标题必须与原标题「${article.title}」完全不同！不要简单修改原标题，要用全新角度重新拟题。`,
        '⚠️ 重要：不要用AI腔。写完之后检查一遍，把所有"在当今""值得一提""总而言之"这种词全部删掉重写。',
        '',
        '请严格按以下格式输出（不要加任何前缀标签，直接输出内容）：',
        '',
        '新标题写在这里',
        '',
        '正文写在这里...',
      ].filter(Boolean).join('\n'),
    },
  ];
}

function parseRewriteResult(result: string): { title: string; content: string } {
  const lines = result.trim().split('\n');
  let title = lines[0] || '';

  title = title
    .replace(/^(第一行[：:]\s*|新标题[：:]|标题[：:]|【新标题】|【标题】|【第一行】)\s*/i, '')
    .replace(/^#+\s*/, '')
    .trim();

  let contentStartIdx = 1;
  while (contentStartIdx < lines.length && lines[contentStartIdx].trim() === '') {
    contentStartIdx++;
  }

  let content = lines.slice(contentStartIdx).join('\n').trim();
  content = content
    .replace(/^(第二行[：:]\s*|第三行[：:]\s*|正文[：:]|【正文】|【内容】|【第二行】|【第三行】)\s*/i, '')
    .trim();

  content = content.replace(/^\*\*[一二三四五六七八九十\d]+[、.．]\s*/gm, '**');

  return { title, content };
}

export async function rewriteArticle(
  article: CandidateArticle,
  settings: Settings,
): Promise<{ title: string; content: string }> {
  const config = getEffectiveAIConfig(settings);
  const messages = buildRewritePrompt(article, settings);
  const result = await callChatAPI(messages, config);
  const parsed = parseRewriteResult(result);
  parsed.content = deAIPostProcess(parsed.content);
  parsed.title = deAIPostProcess(parsed.title);
  return parsed;
}

export async function rewriteBatch(
  articles: CandidateArticle[],
  settings: Settings,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<void> {
  const config = getEffectiveAIConfig(settings);

  const total = articles.length;
  let done = 0;

  for (const article of articles) {
    if (article.rewriteStatus === 'done') {
      done++;
      continue;
    }

    try {
      article.rewriteStatus = 'pending';
      const messages = buildRewritePrompt(article, settings);
      const result = await callChatAPI(messages, config);
      const parsed = parseRewriteResult(result);
      article.rewrittenTitle = deAIPostProcess(parsed.title);
      article.rewrittenContent = deAIPostProcess(parsed.content);
      article.rewriteStatus = 'done';
    } catch (err) {
      article.rewriteStatus = 'failed';
      article.rewrittenContent = `重写失败: ${String(err)}`;
    }

    done++;
    onProgress?.(done, total, article.title);

    if (done < total) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
