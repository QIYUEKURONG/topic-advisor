export type ArticleCategory = '社会' | '娱乐' | '科技' | '财经' | '体育' | '生活' | '视频' | '其他';

export interface CandidateArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  source: string;
  sourceId: string;
  publishedAt?: string;
  imageUrl?: string;
  images: string[];
  videoUrl?: string;
  category: ArticleCategory;
  topicScore: number;
  scoreReasons: string[];
  rewrittenTitle?: string;
  rewrittenContent?: string;
  rewriteStatus?: 'pending' | 'done' | 'failed';
}

export interface CrawlLogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  url?: string;
  reason?: string;
}

export interface CrawlTask {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'failed' | 'exported';
  requestedCount: number;
  fetchedCount: number;
  filteredCount: number;
  failedCount: number;
  candidates: CandidateArticle[];
  startedAt: string;
  endedAt?: string;
  exportDir?: string;
  logs: CrawlLogEntry[];
}

export interface RawArticle {
  title: string;
  content: string;
  url: string;
  source: string;
  sourceId: string;
  publishedAt?: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  category?: ArticleCategory;
}

export type RewritePlatform = 'toutiao' | 'wechat' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo' | 'generic';

export const PLATFORM_PROMPTS: Record<RewritePlatform, { label: string; prompt: string }> = {
  toutiao: {
    label: '今日头条',
    prompt: '你是一位今日头条资深运营编辑。请根据以下新闻素材，重写一篇适合在今日头条发布的文章。\n\n**标题要求：**\n- 标题必须与原标题完全不同，用全新角度拟题\n- 善用疑问句、数字、对比、悬念等手法\n- 标题15-30字，吸引点击但不标题党\n\n**正文要求：**\n1) 使用 Markdown 排版：小标题用 **加粗**，重点用 **加粗** 强调\n2) 开头直击要点，抓住读者注意力\n3) 每段2-3句，段间空一行，适合手机阅读\n4) 适当加入观点分析，引发读者讨论\n5) 字数800-1500字\n6) 结尾引导互动（提问或引发思考）',
  },
  wechat: {
    label: '微信公众号',
    prompt: '你是一位微信公众号资深编辑。请根据以下新闻素材，重写一篇适合在公众号发布的深度文章。\n\n**标题要求：**\n- 标题必须与原标题完全不同\n- 公众号标题风格：可以用 | 分隔、设置悬念\n- 标题长度20-40字\n\n**正文要求：**\n1) 使用 Markdown 排版：小标题用 **加粗**，重要内容用 **加粗** 强调，引用用 > 格式\n2) 开头用一个引人入胜的场景或金句\n3) 行文流畅有质感，像在跟朋友聊天\n4) 字数1000-2000字\n5) 穿插个人观点和独到分析\n6) 分段要有节奏感，长短交替，每段之间空一行\n7) 结尾留一个值得思考的问题',
  },
  xiaohongshu: {
    label: '小红书',
    prompt: '你是一位小红书热门博主。请根据以下新闻素材，写一篇适合小红书的笔记。\n\n**标题要求：**\n- 标题必须与原标题完全不同\n- 小红书标题风格：加emoji、口语化、制造好奇心\n- 例如：「天呐！XXX竟然...」「被种草了！」「姐妹们看过来」\n- 标题15-25字\n\n**正文要求：**\n1) 语气亲切活泼，像闺蜜分享\n2) 大量使用emoji表情点缀\n3) 每段1-2句，超短段落，段间空一行\n4) 字数300-800字\n5) 善用「划重点」「敲黑板」等小红书常用语\n6) 重点内容用 **加粗** 标记\n7) 结尾加上相关话题标签 #xxx# 格式\n8) 加一句互动引导如「你们觉得呢？评论区聊聊~」',
  },
  zhihu: {
    label: '知乎',
    prompt: '你是一位知乎高赞回答者。请根据以下新闻素材，写一篇知乎风格的深度分析文章。\n\n**标题要求：**\n- 标题必须与原标题完全不同\n- 知乎标题风格：「如何看待XXX？」「XXX是一种什么样的体验？」「为什么XXX？」\n\n**正文要求：**\n1) 使用 Markdown 排版：小标题用 **加粗**，引用用 > 格式\n2) 先亮结论，再展开论述\n3) 逻辑严密，有理有据\n4) 引用数据和事实支撑观点\n5) 字数1000-2500字\n6) 段间空一行，每段3-5句\n7) 语气理性客观但有洞见\n8) 结尾总结核心观点',
  },
  douyin: {
    label: '抖音文案',
    prompt: '你是一位抖音爆款文案写手。请根据以下新闻素材，写一段适合抖音视频的文案脚本。\n\n**标题要求：**\n- 标题必须与原标题完全不同\n- 抖音标题风格：短平快、有冲击力、引发好奇\n- 标题10-20字\n\n**正文要求：**\n1) 开头3秒抓住注意力（震惊/反转/悬疑开场）\n2) 语言口语化，像在讲故事\n3) 短句为主，节奏感强，每段1-2句\n4) 字数200-500字\n5) 分清叙述层次：引子→冲突→高潮→结论\n6) 结尾设置互动：「你怎么看？」「关注我了解更多」\n7) 加上3-5个热门话题标签 #xxx',
  },
  weibo: {
    label: '微博',
    prompt: '你是一位微博热门博主。请根据以下新闻素材，写一条适合微博发布的内容。\n\n**标题要求：**\n- 不需要单独标题，直接写正文\n- 第一行就是最吸引人的信息\n\n**正文要求：**\n1) 简洁有力，直击要点\n2) 字数140-500字（核心信息在140字内）\n3) 适当使用emoji但不要太多\n4) 可以用【】标注关键信息\n5) 适当发表观点，引发讨论\n6) 结尾加上2-3个超话标签 #xxx#',
  },
  generic: {
    label: '通用改写',
    prompt: '你是一位资深编辑。请根据以下新闻素材，重写一篇通用风格的文章。\n\n**标题要求：**\n- 标题必须与原标题完全不同，用全新角度\n- 准确传达核心信息\n\n**正文要求：**\n1) 使用 Markdown 排版：小标题用 **加粗**，重点用 **加粗** 强调\n2) 内容通顺准确\n3) 适当加入分析\n4) 字数800-1500字\n5) 分段清晰，每段之间空一行',
  },
};

export type AIProvider = 'deepseek' | 'openai' | 'claude' | 'moonshot' | 'qwen' | 'custom';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const AI_PROVIDER_DEFAULTS: Record<AIProvider, { baseUrl: string; model: string; label: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'DeepSeek' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o', label: 'OpenAI' },
  claude: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', label: 'Claude' },
  moonshot: { baseUrl: 'https://api.moonshot.cn', model: 'moonshot-v1-8k', label: 'Moonshot (月之暗面)' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus', label: '通义千问' },
  custom: { baseUrl: '', model: '', label: '自定义' },
};

export type ImageProvider = 'seedream' | 'dashscope' | 'cogview' | 'custom';

export interface ImageProviderConfig {
  provider: ImageProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const IMAGE_PROVIDER_DEFAULTS: Record<ImageProvider, { baseUrl: string; model: string; label: string }> = {
  seedream: {
    baseUrl: 'https://ark.cn-beijing.volces.com',
    model: 'doubao-seedream-5-0-lite-260128',
    label: '即梦 Seedream (火山引擎)',
  },
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com',
    model: 'wanx-v1',
    label: '通义万相 (阿里云)',
  },
  cogview: {
    baseUrl: 'https://open.bigmodel.cn',
    model: 'cogView-4-250304',
    label: '智谱 CogView-4',
  },
  custom: { baseUrl: '', model: '', label: '自定义' },
};

export type ComicStyle =
  | 'warm' | 'cute' | 'business' | 'retro' | 'simple'
  | 'watercolor' | 'pixel' | 'ukiyoe' | 'poster' | 'sketch' | 'anime'
  | 'aitech' | 'scifi';

export const COMIC_STYLES: Record<ComicStyle, { label: string; description: string; promptHint: string }> = {
  warm: { label: '温馨日常', description: '暖色调家庭风格', promptHint: 'warm family illustration, soft colors, cozy home scene, hand-drawn style' },
  cute: { label: '可爱卡通', description: '圆润Q版角色', promptHint: 'cute chibi cartoon, round characters, pastel colors, kawaii style' },
  business: { label: '商务简约', description: '扁平化职场风', promptHint: 'flat design, business illustration, minimalist, corporate style' },
  retro: { label: '复古怀旧', description: '80年代怀旧画风', promptHint: 'retro vintage illustration, 1980s nostalgia, warm sepia tones' },
  simple: { label: '简笔漫画', description: '黑白线条风格', promptHint: 'simple line drawing comic, black and white, clean lines, manga style' },
  watercolor: { label: '水彩插画', description: '轻柔水彩质感', promptHint: 'watercolor painting style, soft wash, gentle brushstrokes, pastel watercolor illustration' },
  pixel: { label: '像素风', description: '复古游戏像素', promptHint: 'pixel art style, 16-bit retro game art, blocky characters, vibrant pixel colors' },
  ukiyoe: { label: '国风水墨', description: '中国水墨画风', promptHint: 'Chinese ink wash painting style, traditional brush strokes, elegant minimalist, sumi-e' },
  poster: { label: '海报风', description: '大字报宣传画', promptHint: 'bold propaganda poster style, vivid colors, strong contrast, graphic design illustration' },
  sketch: { label: '铅笔素描', description: '手绘铅笔线条', promptHint: 'pencil sketch style, hand drawn graphite, detailed shading, realistic pencil drawing' },
  anime: { label: '日系动漫', description: '日本动漫画风', promptHint: 'Japanese anime illustration style, detailed anime characters, vivid colors, anime art' },
  aitech: { label: 'AI工具风', description: 'AI科技产品插画', promptHint: 'modern AI technology illustration, clean UI mockup style, gradient colors, robot and human interaction, digital workspace, tech product showcase, flat design with subtle 3D elements' },
  scifi: { label: '未来科技', description: '赛博朋克科幻风', promptHint: 'futuristic sci-fi illustration, cyberpunk neon glow, holographic interface, dark background with bright accent colors, high-tech digital environment, circuit board patterns' },
};

export type TextLayout = 'bar' | 'floating' | 'card' | 'minimal';

export const TEXT_LAYOUTS: Record<TextLayout, { label: string; description: string }> = {
  bar: { label: '经典条纹', description: '顶部标题 + 底部信息栏' },
  floating: { label: '浮字投影', description: '文字直接浮在画面上' },
  card: { label: '圆角卡片', description: '小卡片点缀在画面' },
  minimal: { label: '极简底部', description: '仅底部一行薄字' },
};

export type FontStyle = 'default' | 'handwrite' | 'kai' | 'bold' | 'round' | 'elegant';

export const FONT_STYLES: Record<FontStyle, { label: string; fontFamily: string; description: string }> = {
  default: { label: '默认黑体', fontFamily: "'PingFang SC', 'Hiragino Sans GB', sans-serif", description: '清晰易读' },
  handwrite: { label: '手写体', fontFamily: "'STXingkai', 'Xingkai SC', 'PingFang SC', cursive", description: '活泼有趣' },
  kai: { label: '楷体', fontFamily: "'STKaiti', 'Kaiti SC', 'PingFang SC', serif", description: '端正优雅' },
  bold: { label: '粗黑体', fontFamily: "'STHeiti', 'Heiti SC', 'PingFang SC', sans-serif", description: '醒目有力' },
  round: { label: '圆体', fontFamily: "'Yuanti SC', 'PingFang SC', sans-serif", description: '圆润可爱' },
  elegant: { label: '宋体', fontFamily: "'STSong', 'Songti SC', 'PingFang SC', serif", description: '典雅传统' },
};

export type FontColor = 'white' | 'yellow' | 'pink' | 'cyan' | 'orange' | 'lime';

export const FONT_COLORS: Record<FontColor, { label: string; hex: string }> = {
  white:  { label: '白色', hex: '#FFFFFF' },
  yellow: { label: '明黄', hex: '#FFD54F' },
  pink:   { label: '粉色', hex: '#F48FB1' },
  cyan:   { label: '薄荷', hex: '#80CBC4' },
  orange: { label: '橙色', hex: '#FFB74D' },
  lime:   { label: '草绿', hex: '#AED581' },
};

export type ImageMode = 'comparison' | 'normal';

export interface ImageConfig {
  mode: ImageMode;
  hint?: string;
}

export interface StickerRequest {
  topic: string;
  style: ComicStyle;
  fontStyle: FontStyle;
  fontColor: FontColor;
  textLayout: TextLayout;
  imageCount: number;
  imageConfigs: ImageConfig[];
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
  quote?: string;
  copyText?: string;
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

export interface Settings {
  outputDir: string;
  crawlMaxCount: number;
  requestIntervalMs: number;
  topicMode: 'loose' | 'standard' | 'strict';
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
  /** @deprecated use aiProvider.apiKey */
  deepseekApiKey: string;
  /** @deprecated use aiProvider.baseUrl */
  deepseekBaseUrl: string;
}

// ── Share Generator ──

export type UrlType = 'github' | 'paper' | 'article';

export interface ScrapedContent {
  urlType: UrlType;
  url: string;
  title: string;
  description: string;
  body: string;
  images: string[];
  meta: Record<string, string | number>;
}

export interface ShareSection {
  heading: string;
  body: string;
  comicHint?: string;
}

export interface ShareArticle {
  title: string;
  hook: string;
  sections: ShareSection[];
  conclusion: string;
  tags: string[];
}

export interface GeneratedShare {
  id: string;
  url: string;
  urlType: UrlType;
  scraped: ScrapedContent;
  article: ShareArticle;
  comicId?: string;
  status: 'scraping' | 'generating' | 'comics' | 'done' | 'failed';
  error?: string;
  createdAt: string;
}

export interface CrawlerAdapter {
  id: string;
  name: string;
  fetchList(limit: number): Promise<RawArticle[]>;
}

export type SSEEvent =
  | { type: 'progress'; data: { fetched: number; filtered: number; failed: number; total: number; current?: string; phase?: string } }
  | { type: 'rewrite-progress'; data: { done: number; total: number; current?: string } }
  | { type: 'complete'; data: { taskId: string } }
  | { type: 'error'; data: { message: string } };
