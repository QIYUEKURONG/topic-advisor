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

function buildRewritePrompt(article: CandidateArticle, settings: Settings): ChatMessage[] {
  const cleanContent = stripImages(article.content);
  return [
    {
      role: 'system',
      content: settings.rewritePrompt,
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
  return parseRewriteResult(result);
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
      article.rewrittenTitle = parsed.title;
      article.rewrittenContent = parsed.content;
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
