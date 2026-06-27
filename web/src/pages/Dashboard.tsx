import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, createSSE, type TaskSummary } from '../lib/api';

interface Progress {
  fetched: number;
  filtered: number;
  failed: number;
  total: number;
  phase?: string;
}

const TOPIC_PRESETS: Record<string, { label: string; icon: string; extraSources: string[]; keywords: string[] }> = {
  ai: {
    label: 'AI',
    icon: '🤖',
    extraSources: ['baidu-ai-search', 'ithome', 'jiqizhixin', 'qbitai'],
    keywords: [
      'AI', '人工智能', '大模型', 'GPT', 'ChatGPT', 'OpenAI', 'DeepSeek',
      'Claude', 'Gemini', '机器学习', '深度学习', 'AGI', 'AIGC',
      '算力', '芯片', 'GPU', '英伟达', 'NVIDIA',
      'Sora', '文生图', '文生视频', 'AI绘画', 'Midjourney',
      '自动驾驶', '智能体', 'Agent', 'RAG', '向量数据库',
      '大语言模型', 'LLM', '多模态', '具身智能', '机器人',
      'AI监管', 'AI安全', '超级智能', '通用人工智能',
    ],
  },
  invest: {
    label: '投资',
    icon: '💰',
    extraSources: ['baidu-invest-search', 'cls-finance', 'wallstreetcn', 'caixin'],
    keywords: [
      '融资', 'IPO', '上市', 'A股', '港股', '美股', '纳斯达克',
      '估值', '市值', '营收', '利润', '财报', '季报', '年报',
      '投资', '风投', 'VC', 'PE', '天使轮', 'Pre-A', 'B轮',
      '独角兽', '新三板', '科创板', '创业板',
      '收购', '并购', '重组', '股权', '减持', '增持',
      '暴雷', '跑路', '破产', '退市', '爆仓', '清盘',
      '降息', '加息', '通胀', '央行', 'GDP', 'CPI',
      '比特币', '以太坊', '加密货币', '数字货币', 'Web3',
      '新能源', '光伏', '锂电池', '芯片', '半导体',
    ],
  },
  ent: {
    label: '娱乐',
    icon: '🎬',
    extraSources: ['baidu-ent-search'],
    keywords: [
      '明星', '娱乐', '八卦', '热搜', '综艺', '选秀',
      '电影', '电视剧', '票房', '上映', '新片', '预告',
      '偶像', '塌房', '恋情', '官宣', '分手', '离婚',
      '红毯', '颁奖', '金鸡奖', '金像奖', '奥斯卡',
      '抖音', '网红', '直播', '带货', '粉丝', '流量',
    ],
  },
  sports: {
    label: '体育',
    icon: '⚽',
    extraSources: ['baidu-sports-search'],
    keywords: [
      '足球', '篮球', 'NBA', 'CBA', '世界杯', '欧冠',
      '英超', '西甲', '德甲', '意甲', '中超',
      '奥运会', '亚运会', '冠军', '金牌', '世界纪录',
      '网球', '乒乓球', '羽毛球', '游泳', '田径',
      '转会', '教练', '球星', 'MVP', '总决赛',
      '电竞', 'LOL', '王者荣耀', 'DOTA',
    ],
  },
  tech: {
    label: '数码',
    icon: '📱',
    extraSources: ['baidu-tech-search'],
    keywords: [
      '手机', '新品', '发布会', '评测', '测评',
      '苹果', 'iPhone', 'Apple', '华为', 'Mate', '小米',
      '三星', 'OPPO', 'vivo', '一加', '荣耀',
      '笔记本', '平板', 'iPad', 'MacBook',
      '耳机', '手表', '智能家居', '路由器',
      '芯片', '骁龙', '天玑', '处理器', '性能',
      '5G', '6G', '折叠屏', '快充', '续航',
    ],
  },
  health: {
    label: '健康',
    icon: '💊',
    extraSources: ['baidu-health-search'],
    keywords: [
      '养生', '健康', '饮食', '营养', '保健',
      '减肥', '健身', '运动', '瑜伽', '跑步',
      '睡眠', '失眠', '焦虑', '抑郁', '心理',
      '中医', '西医', '偏方', '食疗', '穴位',
      '体检', '癌症', '糖尿病', '高血压', '心脏病',
      '疫苗', '药品', '医院', '医生', '挂号',
    ],
  },
  car: {
    label: '汽车',
    icon: '🚗',
    extraSources: ['baidu-car-search'],
    keywords: [
      '新能源', '电动车', '混动', '增程', '纯电',
      '特斯拉', '比亚迪', '蔚来', '小鹏', '理想',
      '问界', '极氪', '智己', '阿维塔',
      '新车', '上市', '降价', '促销', '优惠',
      '自动驾驶', '智能座舱', '车机', 'OTA',
      '油价', '充电', '电池', '续航', '安全',
      '车展', 'SUV', '轿车', 'MPV', '改装',
    ],
  },
  edu: {
    label: '教育',
    icon: '📚',
    extraSources: ['baidu-edu-search'],
    keywords: [
      '高考', '中考', '考研', '考公', '公务员',
      '分数线', '录取', '招生', '志愿', '大学',
      '教育', '学校', '老师', '学生', '家长',
      '留学', '雅思', '托福', 'GRE', '申请',
      '培训', '考证', '职业', '就业', '薪资',
      '双减', '课外班', '素质教育',
    ],
  },
  food: {
    label: '美食',
    icon: '🍜',
    extraSources: ['baidu-food-search'],
    keywords: [
      '美食', '做法', '食谱', '菜谱', '教程',
      '烘焙', '甜品', '火锅', '烧烤', '小吃',
      '餐饮', '网红店', '打卡', '探店', '排队',
      '奶茶', '咖啡', '蛋糕', '面包',
      '食品安全', '添加剂', '预制菜', '外卖',
      '减脂餐', '轻食', '素食',
    ],
  },
  house: {
    label: '房产',
    icon: '🏠',
    extraSources: ['baidu-house-search'],
    keywords: [
      '房价', '楼市', '买房', '卖房', '二手房',
      '新房', '楼盘', '开盘', '降价', '涨价',
      '房贷', '利率', '首付', '公积金', '月供',
      '限购', '放松', '政策', '调控',
      '装修', '设计', '软装', '家具', '家电',
      '租房', '公租房', '长租公寓',
    ],
  },
  psych: {
    label: '心理学',
    icon: '🧠',
    extraSources: ['baidu-psych-search'],
    keywords: [
      '心理学', '心理健康', '情绪管理', '情感',
      '焦虑', '抑郁', '失眠', '压力', '内耗',
      '心理咨询', '心理治疗', '精神科', '疗愈',
      '人格', '性格', '原生家庭', '依恋', '创伤',
      '认知行为', 'CBT', '正念', '冥想', '疗法',
      'MBTI', '九型人格', '心理测试',
      '社交恐惧', '拖延症', '完美主义', '讨好型',
      '亲密关系', '边界感', '自我成长', '自律',
    ],
  },
  sidehustle: {
    label: '副业赚钱',
    icon: '💼',
    extraSources: ['zhihu-sidehustle', 'xhs-sidehustle', 'v2ex-sidehustle', 'baidu-sidehustle-search'],
    keywords: [
      '副业', '兼职', '赚钱', '挣钱', '搞钱', '外快',
      '接单', '外包', '私活', 'freelance', '自由职业',
      '远程工作', '居家办公', '在家赚钱',
      '变现', '被动收入', '月入',
      '独立开发', '个人项目',
      '自媒体', '知识付费', '写作变现', '带货',
      '闲鱼', '开店', '代购', '跨境电商',
      '接活', '写代码赚钱',
    ],
  },
};

export default function Dashboard() {
  const [count, setCount] = useState(20);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [scoreFilterOn, setScoreFilterOn] = useState(true);
  const navigate = useNavigate();

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await api.listTasks();
      setRecentTasks(tasks.slice(0, 10));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTasks();
    api.getSettings().then(s => setScoreFilterOn(s.enableScoreFilter)).catch(() => {});
  }, [loadTasks]);

  const handleStart = async () => {
    if (running) return;
    setError(null);
    setRunning(true);
    setProgress(null);

    const preset = selectedTopic ? TOPIC_PRESETS[selectedTopic] : null;

    try {
      const res = await api.startTask(
        count,
        preset?.keywords,
        preset?.extraSources,
      );
      setTaskId(res.taskId);

      createSSE(res.taskId, (event) => {
        if (event.type === 'progress') {
          setProgress(event.data);
        } else if (event.type === 'complete') {
          setRunning(false);
          loadTasks();
          navigate(`/tasks/${res.taskId}`);
        } else if (event.type === 'error') {
          setError(event.data.message);
          setRunning(false);
        }
      });
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  };

  const handleStop = async () => {
    if (!taskId) return;
    try {
      await api.stopTask(taskId);
    } catch {
      // ignore
    }
  };

  const toggleTopic = (key: string) => {
    setSelectedTopic((prev) => (prev === key ? null : key));
  };

  const progressPercent = progress
    ? Math.round(((progress.fetched + progress.filtered + progress.failed) / Math.max(progress.total * 2, 1)) * 100)
    : 0;

  const phaseLabel = progress?.phase === 'rewriting' ? 'AI 重写中...' : progress?.phase === 'processing' ? '处理中...' : '抓取中...';

  const activePreset = selectedTopic ? TOPIC_PRESETS[selectedTopic] : null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">抓取控制台</h2>
        <p className="text-gray-500 mt-1">设置参数，选择话题方向，然后开始抓取</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        {/* Count input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            抓取数量
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            disabled={running}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="20"
          />
        </div>

        {/* Topic selection */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            话题方向 <span className="text-gray-400 font-normal">（可选，不选则抓取全类型综合热点内容）</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOPIC_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => toggleTopic(key)}
                disabled={running}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedTopic === key
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
          {activePreset && (
            <div className="mt-2 text-xs text-gray-400">
              将聚焦抓取 {activePreset.label} 相关内容，额外搜索 {activePreset.extraSources.length} 个专属来源
            </div>
          )}
        </div>

        {/* Start button */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scoreFilterOn}
              onChange={async (e) => {
                const v = e.target.checked;
                setScoreFilterOn(v);
                try { await api.updateSettings({ enableScoreFilter: v }); } catch {}
              }}
              className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">评分过滤</span>
          </label>

          {!running ? (
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 active:bg-brand-700 transition-colors shadow-sm"
            >
              {selectedTopic ? `开始抓取 ${TOPIC_PRESETS[selectedTopic].label} 内容` : '开始抓取'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-8 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors shadow-sm"
            >
              停止
            </button>
          )}
          {selectedTopic && !running && (
            <button
              onClick={() => setSelectedTopic(null)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              清除话题
            </button>
          )}
        </div>

        {running && progress && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                {activePreset ? `${activePreset.label} ` : ''}{phaseLabel}
              </span>
              <span>候选 {progress.fetched} · 过滤 {progress.filtered} · 失败 {progress.failed}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-brand-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Tutorial section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">使用指南</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GuideCard
            step="1"
            title="配置 AI 模型"
            desc="在设置页面选择 AI 供应商，填入 API Key"
            action="去配置"
            onAction={() => navigate('/settings')}
          />
          <GuideCard
            step="2"
            title="抓取新闻内容"
            desc="设置数量和话题，点击开始抓取"
          />
          <GuideCard
            step="3"
            title="AI 改写"
            desc="在候选页点击改写按钮，选择目标平台风格"
          />
          <GuideCard
            step="4"
            title="发布"
            desc="登录头条号，一键同步到草稿箱"
          />
        </div>
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-600">💡 提示：</span>
          同一篇文章可以按不同平台风格多次改写 · 推荐使用 DeepSeek（性价比最高）· 在设置中可自定义改写提示词
        </div>
      </div>

      {recentTasks.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近任务</h3>
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={task.status} />
                    <span className="text-sm text-gray-600">
                      {new Date(task.startedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>请求 {task.requestedCount}</span>
                    <span className="text-green-600">候选 {task.candidateCount}</span>
                    <span>过滤 {task.filteredCount}</span>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuideCard({
  step, title, desc, action, onAction,
}: {
  step: string; title: string; desc: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {step}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-medium text-gray-800">{title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        {action && onAction && (
          <button
            onClick={onAction}
            className="mt-1 text-xs text-brand-600 hover:text-brand-700 hover:underline"
          >
            {action} →
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    stopped: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    exported: 'bg-purple-100 text-purple-700',
  };

  const labels: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    stopped: '已停止',
    failed: '失败',
    exported: '已导出',
  };

  return (
    <span className={`score-badge ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
