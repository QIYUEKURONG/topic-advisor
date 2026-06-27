import { useState, useEffect, useCallback, useMemo } from 'react';
import { trendApi } from '../lib/api';
import type { TrendSnapshot, TrendItem, HotTopic, ViralAnalysis, TrendPlatform, TrendDirection } from '../lib/api';

const TREND_ICONS: Record<string, string> = { rising: '🔥', stable: '➡️', declining: '📉' };
const TREND_COLORS: Record<string, string> = {
  rising: 'text-red-500',
  stable: 'text-gray-400',
  declining: 'text-blue-400',
};

function ScoreBar({ score, max, color = 'bg-brand-500' }: { score: number; max: number; color?: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EngagementBadge({ value, label }: { value?: number; label: string }) {
  if (!value || value <= 0) return null;
  const display = value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
  return (
    <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
      {label} {display}
    </span>
  );
}

export default function TrendAnalyzer() {
  const [snapshot, setSnapshot] = useState<TrendSnapshot | null>(null);
  const [platforms, setPlatforms] = useState<TrendPlatform[]>([]);
  const [directions, setDirections] = useState<TrendDirection[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedDirection, setSelectedDirection] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'hotmap' | 'ranking' | 'analyze'>('hotmap');

  const [analyzeTitle, setAnalyzeTitle] = useState('');
  const [analyzeContent, setAnalyzeContent] = useState('');
  const [analysis, setAnalysis] = useState<ViralAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    trendApi.getPlatforms().then(setPlatforms).catch(() => {});
    trendApi.getDirections().then(setDirections).catch(() => {});
    trendApi.getLatest().then((data) => {
      if (data && 'id' in data) setSnapshot(data as TrendSnapshot);
    }).catch(() => {});
  }, []);

  const handleCrawl = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trendApi.startCrawl(
        selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        selectedDirection || undefined,
      );
      setSnapshot(result);
    } catch (err: any) {
      alert('抓取失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [selectedPlatforms, selectedDirection]);

  const handleAnalyze = useCallback(async () => {
    if (!analyzeTitle && !analyzeContent) return;
    setAnalyzing(true);
    try {
      const result = await trendApi.analyzeArticle(analyzeTitle, analyzeContent);
      setAnalysis(result);
    } catch {
      alert('分析失败');
    } finally {
      setAnalyzing(false);
    }
  }, [analyzeTitle, analyzeContent]);

  const togglePlatform = useCallback((id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const categoryStats = useMemo(() => {
    if (!snapshot) return [];
    const map = new Map<string, number>();
    for (const item of snapshot.items) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: Math.round((count / snapshot.items.length) * 100) }));
  }, [snapshot]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🔥 爆火趋势分析</h1>
          <p className="text-sm text-gray-500 mt-1">
            {snapshot ? `最新数据: ${snapshot.date} · ${snapshot.items.length}篇 · ${snapshot.hotTopics.length}个热点` : '暂无数据，点击抓取开始'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-400 block mb-1">方向</label>
            <select
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
            >
              <option value="">全部方向</option>
              {directions.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-[300px]">
            <label className="text-xs text-gray-400 block mb-1">平台 (不选=全部)</label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    selectedPlatforms.includes(p.id)
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCrawl}
            disabled={loading}
            className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? '抓取中...' : '🔍 开始抓取'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['hotmap', 'ranking', 'analyze'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t === 'hotmap' && '🗺️ 热点图'}
            {t === 'ranking' && '📊 排行榜'}
            {t === 'analyze' && '🎯 文章分析'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'hotmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hot Topics */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-4">热点话题</h2>
            {!snapshot || snapshot.hotTopics.length === 0 ? (
              <p className="text-gray-500 text-center py-10">暂无数据，请先抓取</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {snapshot.hotTopics.map((topic, i) => (
                  <HotTopicCard key={topic.keyword} topic={topic} rank={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Category Distribution */}
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-4">分类分布</h2>
            {categoryStats.length === 0 ? (
              <p className="text-gray-500 text-center py-10">暂无数据</p>
            ) : (
              <div className="space-y-3">
                {categoryStats.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{cat.name}</span>
                      <span className="text-gray-400">{cat.count}篇 ({cat.pct}%)</span>
                    </div>
                    <ScoreBar score={cat.pct} max={100} color="bg-orange-500" />
                  </div>
                ))}
              </div>
            )}

            {/* Writing Advice */}
            {snapshot && snapshot.hotTopics.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-bold mb-2">📝 写作建议</h3>
                <ul className="text-xs text-gray-400 space-y-2">
                  {snapshot.hotTopics.filter((t) => t.trend === 'rising').slice(0, 3).map((t) => (
                    <li key={t.keyword} className="flex items-start gap-1">
                      <span className="text-red-400">🔥</span>
                      <span>「{t.keyword}」正在上升，有{t.count}篇相关内容，建议赶快写</span>
                    </li>
                  ))}
                  {snapshot.hotTopics.slice(0, 1).map((t) => (
                    <li key={`top-${t.keyword}`} className="flex items-start gap-1">
                      <span>👑</span>
                      <span>今日最热: 「{t.keyword}」，平均互动{t.avgEngagement}分</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'ranking' && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">高互动文章排行</h2>
          {!snapshot || snapshot.items.length === 0 ? (
            <p className="text-gray-500 text-center py-10">暂无数据，请先抓取</p>
          ) : (
            <div className="space-y-2">
              {snapshot.items.slice(0, 50).map((item, i) => (
                <RankingItem key={item.id} item={item} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'analyze' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-4">文章爆火潜力分析</h2>
            <p className="text-xs text-gray-400 mb-4">粘贴你的文章标题和内容，分析爆火概率</p>
            <div className="space-y-3">
              <input
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                placeholder="文章标题"
                value={analyzeTitle}
                onChange={(e) => setAnalyzeTitle(e.target.value)}
              />
              <textarea
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm h-48 resize-none"
                placeholder="文章内容..."
                value={analyzeContent}
                onChange={(e) => setAnalyzeContent(e.target.value)}
              />
              <button
                onClick={handleAnalyze}
                disabled={analyzing || (!analyzeTitle && !analyzeContent)}
                className="w-full bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
              >
                {analyzing ? '分析中...' : '🎯 分析爆火潜力'}
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5">
            {!analysis ? (
              <div className="text-center text-gray-500 py-20">
                <p className="text-4xl mb-3">📊</p>
                <p>输入文章后点击分析</p>
              </div>
            ) : (
              <AnalysisResult analysis={analysis} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HotTopicCard({ topic, rank }: { topic: HotTopic; rank: number }) {
  const sizeClass = rank <= 3 ? 'text-base font-bold' : rank <= 10 ? 'text-sm font-medium' : 'text-xs';
  const bgClass = rank <= 3 ? 'bg-gradient-to-br from-orange-600/30 to-red-600/30 border-orange-500/30' :
    rank <= 10 ? 'bg-gray-700/50 border-gray-600/50' : 'bg-gray-700/30 border-gray-700/30';

  return (
    <div className={`rounded-lg p-3 border ${bgClass} hover:border-brand-500/50 transition-colors cursor-default`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`${sizeClass} truncate`}>{topic.keyword}</span>
        <span className={`text-xs ${TREND_COLORS[topic.trend]}`}>{TREND_ICONS[topic.trend]}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{topic.count}篇</span>
        <span>互动 {topic.avgEngagement}</span>
      </div>
    </div>
  );
}

function RankingItem({ item, rank }: { item: TrendItem; rank: number }) {
  const rankColor = rank <= 3 ? 'bg-red-500' : rank <= 10 ? 'bg-orange-500' : 'bg-gray-600';
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-700/50 transition-colors">
      <span className={`${rankColor} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:text-brand-400 truncate block"
        >
          {item.title}
        </a>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{item.source}</span>
          <EngagementBadge value={item.engagement.reads} label="阅读" />
          <EngagementBadge value={item.engagement.comments} label="评论" />
          <EngagementBadge value={item.engagement.likes} label="点赞" />
          {item.keywords.slice(0, 3).map((kw) => (
            <span key={kw} className="text-xs text-brand-400">#{kw}</span>
          ))}
        </div>
      </div>
      <span className="text-sm font-mono text-orange-400 flex-shrink-0">
        {Math.round(item.engagement.score)}
      </span>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: ViralAnalysis }) {
  const scoreColor = analysis.score >= 70 ? 'text-green-400' : analysis.score >= 40 ? 'text-yellow-400' : 'text-red-400';
  const scoreLabel = analysis.score >= 70 ? '爆火潜力高' : analysis.score >= 40 ? '有一定潜力' : '需要优化';

  return (
    <div>
      <div className="text-center mb-6">
        <div className={`text-5xl font-bold ${scoreColor}`}>{analysis.score}</div>
        <div className="text-sm text-gray-400 mt-1">{scoreLabel} (满分{analysis.maxScore})</div>
      </div>

      <div className="space-y-3 mb-6">
        {analysis.breakdown.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-sm mb-1">
              <span>{item.label}</span>
              <span className="text-gray-400">{item.score}/{item.maxScore}</span>
            </div>
            <ScoreBar
              score={item.score}
              max={item.maxScore}
              color={item.score >= item.maxScore * 0.7 ? 'bg-green-500' : item.score >= item.maxScore * 0.4 ? 'bg-yellow-500' : 'bg-red-500'}
            />
            <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
          </div>
        ))}
      </div>

      {analysis.matchedTrends.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold mb-2">命中热点</h3>
          <div className="flex flex-wrap gap-1">
            {analysis.matchedTrends.map((t) => (
              <span key={t} className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">🔥 {t}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">优化建议</h3>
          <ul className="space-y-1">
            {analysis.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span>💡</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
