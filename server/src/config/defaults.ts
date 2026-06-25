import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Settings } from '../types.js';

function getDefaultOutputDir(): string {
  if (process.env.NODE_ENV === 'production') {
    return join(homedir(), 'Documents', 'TopicAdvisor');
  }
  return './output';
}

export const DEFAULT_SETTINGS: Settings = {
  outputDir: getDefaultOutputDir(),
  crawlMaxCount: 200,
  requestIntervalMs: 1200,
  topicMode: 'standard',
  enabledSources: [
    'sina-society', 'netease-news', 'sohu-ent',
    'tencent-news', 'ifeng-news', 'thepaper', 'baidu-hot', '36kr', 'ithome',
    'xiaohongshu', 'bilibili-hot', 'weibo-hot',
    'toutiao-hot', 'zhihu-hot', 'douyin-hot',
    'huxiu', 'guancha', 'cls-finance',
    'wallstreetcn', 'jiemian',
  ],
  sensitiveWords: [
    '批判中国', '批判政府', '反华', '反共', '颠覆政权',
    '台独', '藏独', '疆独', '法轮功', '六四',
    '习近平', '政治体制', '一党专政', '独裁',
  ],
  topicKeywords: [
    '热搜', '争议', '炸锅', '怒了', '崩了', '翻车', '塌房',
    '官宣', '实锤', '反转', '曝光', '维权', '道歉',
    '离婚', '出轨', '分手', '恋情', '绯闻',
    '暴雷', '跑路', '破产', '裁员', '降薪',
    '食品安全', '315', '消费者', '投诉', '黑幕',
  ],
  repostTemplate: '本文转载自 {source}，原文链接：{url}',
  dedupWindowHours: 24,
  enableScoreFilter: false,
  enableRewrite: false,
  aiProvider: {
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  imageProvider: {
    provider: 'seedream',
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    model: 'doubao-seedream-5-0-lite-260128',
  },
  rewritePrompt: '你是一位资深自媒体运营编辑，擅长取标题和内容改写。请根据以下新闻素材，重写一篇可以直接发布的文章。\n\n**标题要求（最重要）：**\n- 标题必须与原标题完全不同，不能只是简单调换语序或加减几个字\n- 用全新的角度和表达方式重新拟标题\n- 可以提炼新闻中最有冲击力、最有话题性的点作为标题切入\n- 善用疑问句、数字、对比、悬念等手法增强吸引力\n- 标题长度15-30字，不标题党但要有吸引力\n\n**正文排版要求（非常重要）：**\n1) 每篇文章中，核心观点、关键数据、重要人物名字等必须用 **加粗** 标记（每段至少有1-2处加粗）\n2) 每段之间必须空一行，段落简短（2-4句话），适合手机阅读\n3) 如果有多个要点，用小标题分隔，小标题也用 **加粗**\n4) 可以用 > 引用格式来突出金句或关键引言\n\n**内容要求：**\n1) 内容通顺、信息准确、有可读性\n2) 适当加入个人观点或分析\n3) 字数800-1500字',
  githubToken: '',
  deepseekApiKey: '',
  deepseekBaseUrl: 'https://api.deepseek.com',
};
