const BASE = '/api';

export type AIProvider = 'deepseek' | 'openai' | 'claude' | 'moonshot' | 'qwen' | 'custom';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const AI_PROVIDER_OPTIONS: Array<{ id: AIProvider; label: string; baseUrl: string; model: string }> = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com', model: 'gpt-4o' },
  { id: 'claude', label: 'Claude', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { id: 'moonshot', label: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn', model: 'moonshot-v1-8k' },
  { id: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus' },
  { id: 'custom', label: '自定义', baseUrl: '', model: '' },
];

export interface AppSettings {
  outputDir: string;
  crawlMaxCount: number;
  requestIntervalMs: number;
  topicMode: string;
  enabledSources: string[];
  sensitiveWords: string[];
  topicKeywords: string[];
  repostTemplate: string;
  dedupWindowHours: number;
  enableScoreFilter: boolean;
  enableRewrite: boolean;
  aiProvider: AIProviderConfig;
  rewritePrompt: string;
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export interface TaskSummary {
  id: string;
  status: string;
  requestedCount: number;
  fetchedCount: number;
  filteredCount: number;
  failedCount: number;
  candidateCount: number;
  startedAt: string;
  endedAt?: string;
}

export type ArticleCategory = '社会' | '娱乐' | '科技' | '财经' | '体育' | '生活' | '视频' | '其他';

export interface CandidateArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  source: string;
  topicScore: number;
  scoreReasons: string[];
  publishedAt?: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  category: ArticleCategory;
  rewrittenTitle?: string;
  rewrittenContent?: string;
  rewriteStatus?: 'pending' | 'done' | 'failed';
}

export interface CrawlTask {
  id: string;
  status: string;
  requestedCount: number;
  fetchedCount: number;
  filteredCount: number;
  failedCount: number;
  candidates: CandidateArticle[];
  startedAt: string;
  endedAt?: string;
  exportDir?: string;
  logs: Array<{ time: string; level: string; message: string }>;
}

export const api = {
  startTask: (count: number, topicKeywords?: string[], extraSources?: string[]) =>
    request<{ taskId: string; status: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        count,
        ...(topicKeywords ? { topicKeywords } : {}),
        ...(extraSources ? { extraSources } : {}),
      }),
    }),

  rewriteArticle: (taskId: string, articleId: string, platform?: string) =>
    request<{ id: string; rewrittenTitle: string; rewrittenContent: string; platform: string }>(
      `/tasks/${taskId}/articles/${articleId}/rewrite`,
      {
        method: 'POST',
        body: JSON.stringify(platform ? { platform } : {}),
      },
    ),

  getPlatforms: () =>
    request<Array<{ id: string; label: string }>>('/platforms'),

  listTasks: () => request<TaskSummary[]>('/tasks'),

  getTask: (id: string) => request<CrawlTask>(`/tasks/${id}`),

  stopTask: (id: string) =>
    request<{ message: string }>(`/tasks/${id}/stop`, { method: 'POST' }),

  updateArticleTitle: (taskId: string, articleId: string, title: string) =>
    request<{ id: string; title: string }>(`/tasks/${taskId}/articles/${articleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  exportSelected: (id: string, articleIds: string[]) =>
    request<{ exportDir: string; count: number }>(`/tasks/${id}/export`, {
      method: 'POST',
      body: JSON.stringify({ articleIds }),
    }),

  getSettings: () => request<AppSettings>('/settings'),

  updateSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  toutiaoStatus: () =>
    request<{ loggedIn: boolean; username?: string; avatar?: string }>('/toutiao/status'),

  toutiaoLogin: () =>
    request<{ status: string }>('/toutiao/login', { method: 'POST' }),

  toutiaoWaitLogin: () =>
    request<{ loggedIn: boolean; username?: string; avatar?: string }>('/toutiao/login/wait', {
      method: 'POST',
    }),

  toutiaoLogout: () =>
    request<{ loggedIn: boolean }>('/toutiao/logout', { method: 'POST' }),

  toutiaoPublish: (taskId: string, articleIds: string[]) =>
    request<{
      total: number;
      success: number;
      failed: number;
      results: Array<{
        articleId: string;
        title: string;
        success: boolean;
        pgcId?: string;
        draftUrl?: string;
        error?: string;
      }>;
    }>(`/toutiao/publish/${taskId}`, {
      method: 'POST',
      body: JSON.stringify({ articleIds }),
    }),
};

export function createSSE(taskId: string, onEvent: (event: { type: string; data: any }) => void) {
  const es = new EventSource(`${BASE}/tasks/${taskId}/events`);

  es.addEventListener('progress', (e) => {
    onEvent({ type: 'progress', data: JSON.parse(e.data) });
  });

  es.addEventListener('complete', (e) => {
    onEvent({ type: 'complete', data: JSON.parse(e.data) });
    es.close();
  });

  es.addEventListener('error', (e) => {
    if (es.readyState === EventSource.CLOSED) return;
    onEvent({ type: 'error', data: { message: 'Connection lost' } });
  });

  return es;
}
