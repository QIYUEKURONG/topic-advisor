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

export type ImageProvider = 'seedream' | 'dashscope' | 'cogview' | 'custom';

export interface ImageProviderConfig {
  provider: ImageProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const IMAGE_PROVIDER_OPTIONS: Array<{ id: ImageProvider; label: string; baseUrl: string; model: string }> = [
  { id: 'seedream', label: '即梦 Seedream (火山引擎)', baseUrl: 'https://ark.cn-beijing.volces.com', model: 'doubao-seedream-5-0-lite-260128' },
  { id: 'dashscope', label: '通义万相 (阿里云)', baseUrl: 'https://dashscope.aliyuncs.com', model: 'wanx-v1' },
  { id: 'cogview', label: '智谱 CogView-4', baseUrl: 'https://open.bigmodel.cn', model: 'cogView-4-250304' },
  { id: 'custom', label: '自定义', baseUrl: '', model: '' },
];

export type ComicStyle = 'warm' | 'cute' | 'business' | 'retro' | 'simple'
  | 'watercolor' | 'pixel' | 'ukiyoe' | 'poster' | 'sketch' | 'anime';

export const COMIC_STYLE_OPTIONS: Array<{ id: ComicStyle; label: string; description: string; emoji: string }> = [
  { id: 'warm', label: '温馨日常', description: '暖色调家庭风格', emoji: '🏠' },
  { id: 'cute', label: '可爱卡通', description: '圆润Q版角色', emoji: '🧸' },
  { id: 'business', label: '商务简约', description: '扁平化职场风', emoji: '💼' },
  { id: 'retro', label: '复古怀旧', description: '80年代怀旧画风', emoji: '📻' },
  { id: 'simple', label: '简笔漫画', description: '黑白线条风格', emoji: '✏️' },
  { id: 'watercolor', label: '水彩插画', description: '轻柔水彩质感', emoji: '🎨' },
  { id: 'pixel', label: '像素风', description: '复古游戏像素', emoji: '👾' },
  { id: 'ukiyoe', label: '国风水墨', description: '中国水墨画风', emoji: '🏯' },
  { id: 'poster', label: '海报风', description: '大字报宣传画', emoji: '📢' },
  { id: 'sketch', label: '铅笔素描', description: '手绘铅笔线条', emoji: '✎' },
  { id: 'anime', label: '日系动漫', description: '日本动漫画风', emoji: '🌸' },
];

export type TextLayout = 'bar' | 'floating' | 'card' | 'minimal';

export const TEXT_LAYOUT_OPTIONS: Array<{ id: TextLayout; label: string; description: string }> = [
  { id: 'bar', label: '经典条纹', description: '顶部标题+底部信息栏' },
  { id: 'floating', label: '浮字投影', description: '文字浮在画面上' },
  { id: 'card', label: '圆角卡片', description: '小卡片点缀' },
  { id: 'minimal', label: '极简底部', description: '仅底部一行' },
];

export type FontColor = 'white' | 'yellow' | 'pink' | 'cyan' | 'orange' | 'lime';

export const FONT_COLOR_OPTIONS: Array<{ id: FontColor; label: string; hex: string }> = [
  { id: 'white', label: '白色', hex: '#FFFFFF' },
  { id: 'yellow', label: '明黄', hex: '#FFD54F' },
  { id: 'pink', label: '粉色', hex: '#F48FB1' },
  { id: 'cyan', label: '薄荷', hex: '#80CBC4' },
  { id: 'orange', label: '橙色', hex: '#FFB74D' },
  { id: 'lime', label: '草绿', hex: '#AED581' },
];

export type FontStyle = 'default' | 'handwrite' | 'kai' | 'bold' | 'round' | 'elegant';

export const FONT_STYLE_OPTIONS: Array<{ id: FontStyle; label: string; description: string }> = [
  { id: 'default', label: '默认黑体', description: '清晰易读' },
  { id: 'handwrite', label: '手写体', description: '活泼有趣' },
  { id: 'kai', label: '楷体', description: '端正优雅' },
  { id: 'bold', label: '粗黑体', description: '醒目有力' },
  { id: 'round', label: '圆体', description: '圆润可爱' },
  { id: 'elegant', label: '宋体', description: '典雅传统' },
];

export type ImageMode = 'comparison' | 'normal';

export interface ImageConfig {
  mode: ImageMode;
  hint?: string;
}

export interface ComparisonSide {
  title: string;
  scene: string;
  emotion: string;
}

export interface ScriptImage {
  mode: ImageMode;
  title: string;
  left?: ComparisonSide;
  right?: ComparisonSide;
  scene?: string;
  caption?: string;
  tips?: string[];
  copyText?: string;
  quote?: string;
}

export interface ComicScript {
  topic: string;
  overallTitle: string;
  characterDescription: string;
  images: ScriptImage[];
}

export interface GeneratedComic {
  id: string;
  topic: string;
  style: ComicStyle;
  script: ComicScript;
  rawImages: string[];
  finalImages: string[];
  status: 'generating' | 'done' | 'failed';
  error?: string;
  createdAt: string;
  version?: number;
}

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
  imageProvider: ImageProviderConfig;
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

  listComics: () => request<GeneratedComic[]>('/stickers'),

  getComic: (id: string) => request<GeneratedComic>(`/stickers/${id}`),

  getComicImageUrl: (comicId: string, filename: string, version?: number) =>
    `${BASE}/stickers/${comicId}/images/${filename}${version ? `?v=${version}` : ''}`,

  recomposeComic: (comicId: string, fontStyle: FontStyle, textLayout: TextLayout, fontColor: FontColor) =>
    request<GeneratedComic>(`/stickers/${comicId}/recompose`, {
      method: 'POST',
      body: JSON.stringify({ fontStyle, textLayout, fontColor }),
    }),

  getExportUrl: (comicId: string, layout: 'grid' | 'vertical' | 'horizontal' = 'grid') =>
    `${BASE}/stickers/${comicId}/export?layout=${layout}`,
};

export function createStickerSSE(
  topic: string,
  style: ComicStyle,
  fontStyle: FontStyle,
  fontColor: FontColor,
  textLayout: TextLayout,
  imageConfigs: ImageConfig[],
  onEvent: (event: { type: string; data: any }) => void,
): EventSource {
  const params = new URLSearchParams({
    topic,
    style,
    fontStyle,
    fontColor,
    textLayout,
    imageCount: String(imageConfigs.length),
    configs: JSON.stringify(imageConfigs),
  });
  const es = new EventSource(`${BASE}/stickers/generate?${params}`);
  let finished = false;

  es.addEventListener('progress', (e) => {
    onEvent({ type: 'progress', data: JSON.parse(e.data) });
  });

  es.addEventListener('complete', (e) => {
    finished = true;
    es.close();
    onEvent({ type: 'complete', data: JSON.parse(e.data) });
  });

  es.addEventListener('error', (e: any) => {
    if (finished) return;
    try {
      const data = e.data ? JSON.parse(e.data) : { message: '生成失败，请检查 API 配置' };
      finished = true;
      es.close();
      onEvent({ type: 'error', data });
    } catch {
      if (es.readyState !== EventSource.CLOSED) {
        finished = true;
        es.close();
        onEvent({ type: 'error', data: { message: '连接中断，请检查服务器日志' } });
      }
    }
  });

  return es;
}

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
