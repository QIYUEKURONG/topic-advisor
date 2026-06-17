import type { ArticleCategory, RawArticle } from '../types.js';

const CATEGORY_KEYWORDS: Record<ArticleCategory, string[]> = {
  '娱乐': [
    '明星', '演员', '导演', '电影', '电视剧', '综艺', '选秀', '偶像',
    '恋情', '离婚', '出轨', '分手', '官宣', '塌房', '翻车', '绯闻',
    '粉丝', '流量', '热搜', '八卦', '娱乐圈', '演唱会', '音乐',
    '歌手', '网红', '主播', '直播', '短视频', '抖音', 'B站',
  ],
  '科技': [
    'AI', '人工智能', '芯片', '手机', '苹果', '华为', '小米',
    '互联网', '大模型', '机器人', '自动驾驶', '新能源', '电动车',
    '特斯拉', '比亚迪', '5G', '算法', '数据', '云计算',
    '程序员', '裁员', '科技', '技术', 'OpenAI', 'ChatGPT',
  ],
  '财经': [
    '股市', '基金', '理财', 'A股', '港股', '美股', '上市',
    '融资', '破产', '暴雷', '跑路', '经济', '房价', '楼市',
    '银行', '利率', '通胀', '降息', '央行', '税', '营收',
    'GDP', '消费', '就业', '工资', '降薪', '裁员',
  ],
  '体育': [
    '足球', '篮球', 'NBA', 'CBA', '世界杯', '奥运',
    '冠军', '联赛', '教练', '球员', '转会', '比赛',
    '金牌', '运动', '体育', '马拉松', '电竞',
  ],
  '社会': [
    '法院', '警方', '刑拘', '逮捕', '犯罪', '诈骗', '贪污',
    '事故', '地震', '洪水', '火灾', '救援', '医院',
    '教育', '高考', '学校', '食品安全', '315', '维权',
    '投诉', '黑幕', '村', '城市', '交通', '环境',
  ],
  '生活': [
    '美食', '旅游', '健康', '养生', '减肥', '穿搭',
    '育儿', '婚姻', '家庭', '宠物', '装修', '购物',
  ],
  '视频': [],
  '其他': [],
};

export function classifyArticle(article: RawArticle): ArticleCategory {
  if (article.category) return article.category;
  if (article.videoUrl) return '视频';

  const text = `${article.title} ${article.content.slice(0, 500)}`;
  const scores: Partial<Record<ArticleCategory, number>> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === '视频' || category === '其他') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score++;
    }
    if (score > 0) {
      scores[category as ArticleCategory] = score;
    }
  }

  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
  return entries.length > 0 ? (entries[0][0] as ArticleCategory) : '其他';
}
