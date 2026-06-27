import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api, type CrawlTask, type CandidateArticle, type ArticleCategory } from '../lib/api';

const ALL_CATEGORIES: ArticleCategory[] = ['社会', '娱乐', '科技', '财经', '体育', '生活', '视频', '其他'];

type ContentType = 'all' | 'article' | 'video';

const PLATFORM_OPTIONS = [
  { id: 'toutiao', label: '头条', icon: '📰' },
  { id: 'wechat', label: '公众号', icon: '💬' },
  { id: 'xiaohongshu', label: '小红书', icon: '📕' },
  { id: 'zhihu', label: '知乎', icon: '🔍' },
  { id: 'douyin', label: '抖音', icon: '🎵' },
  { id: 'weibo', label: '微博', icon: '🔥' },
  { id: 'generic', label: '通用', icon: '✏️' },
];

export default function Candidates() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<CrawlTask | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | 'all'>('all');
  const [activeSource, setActiveSource] = useState<string>('all');
  const [contentType, setContentType] = useState<ContentType>('all');
  const [toutiaoUser, setToutiaoUser] = useState<{ loggedIn: boolean; username?: string; available?: boolean } | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<Array<{
    articleId: string; title: string; success: boolean; draftUrl?: string; error?: string;
  }> | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getTask(id).then(setTask).catch((e) => setError(e.message));
    api.toutiaoStatus().then(setToutiaoUser).catch(() => setToutiaoUser({ loggedIn: false }));
  }, [id]);

  const categoryStats = useMemo(() => {
    if (!task) return {};
    const stats: Record<string, number> = {};
    for (const c of task.candidates) {
      stats[c.category] = (stats[c.category] || 0) + 1;
    }
    return stats;
  }, [task]);

  const contentTypeStats = useMemo(() => {
    if (!task) return { article: 0, video: 0 };
    let article = 0, video = 0;
    for (const c of task.candidates) {
      if (c.videoUrl) video++;
      else article++;
    }
    return { article, video };
  }, [task]);

  const sourceStats = useMemo(() => {
    if (!task) return {} as Record<string, number>;
    const stats: Record<string, number> = {};
    for (const c of task.candidates) {
      const src = c.source || '未知';
      stats[src] = (stats[src] || 0) + 1;
    }
    return stats;
  }, [task]);

  const filteredCandidates = useMemo(() => {
    if (!task) return [];
    let items = task.candidates;

    if (contentType === 'video') {
      items = items.filter((c) => c.videoUrl);
    } else if (contentType === 'article') {
      items = items.filter((c) => !c.videoUrl);
    }

    if (activeCategory !== 'all') {
      items = items.filter((c) => c.category === activeCategory);
    }

    if (activeSource !== 'all') {
      items = items.filter((c) => c.source === activeSource);
    }

    return [...items].sort((a, b) => b.topicScore - a.topicScore);
  }, [task, activeCategory, activeSource, contentType]);

  const toggleSelect = (articleId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!task) return;
    const current = filteredCandidates.map((a) => a.id);
    if (current.every((id) => selected.has(id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of current) next.delete(id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of current) next.add(id);
        return next;
      });
    }
  };

  const handleExport = async () => {
    if (!id || selected.size === 0) return;
    setExporting(true);
    setError(null);
    try {
      const res = await api.exportSelected(id, Array.from(selected));
      setExported(res.exportDir);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleToutiaoLogin = async () => {
    setLoginLoading(true);
    setError(null);
    try {
      await api.toutiaoLogin();
      const status = await api.toutiaoWaitLogin();
      setToutiaoUser(status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleToutiaoLogout = async () => {
    await api.toutiaoLogout();
    setToutiaoUser({ loggedIn: false });
  };

  const handlePublishDrafts = async () => {
    if (!id || selected.size === 0) return;
    setPublishing(true);
    setError(null);
    setPublishResults(null);
    try {
      const res = await api.toutiaoPublish(id, Array.from(selected));
      setPublishResults(res.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleRewrite = async (articleId: string, platform?: string) => {
    if (!id) return;
    setError(null);
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        candidates: prev.candidates.map((c) =>
          c.id === articleId ? { ...c, rewriteStatus: 'pending' as const } : c,
        ),
      };
    });

    try {
      const res = await api.rewriteArticle(id, articleId, platform);
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.id === articleId
              ? { ...c, rewrittenTitle: res.rewrittenTitle, rewrittenContent: res.rewrittenContent, rewriteStatus: 'done' as const }
              : c,
          ),
        };
      });
    } catch (err: any) {
      setError(`重写失败: ${err.message}`);
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.id === articleId ? { ...c, rewriteStatus: 'failed' as const } : c,
          ),
        };
      });
    }
  };

  if (error && !task) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
        <button onClick={() => navigate('/')} className="mt-4 text-brand-500 hover:underline">
          ← 返回控制台
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="animate-pulse text-4xl mb-4">⏳</div>
        加载中...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-brand-500 mb-1"
          >
            ← 返回控制台
          </button>
          <h2 className="text-2xl font-bold">候选内容</h2>
          <p className="text-gray-500 text-sm mt-1">
            共 {task.candidates.length} 条候选 · 已选 {selected.size} 条
            {task.exportDir && <span className="text-purple-600 ml-2">已导出</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showLogs ? '隐藏日志' : '查看日志'}
          </button>
          <button
            onClick={toggleAll}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {filteredCandidates.every((c) => selected.has(c.id)) && filteredCandidates.length > 0 ? '取消全选' : '全选'}
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="px-6 py-2 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? '导出中...' : `导出 ${selected.size} 条`}
          </button>
        </div>
      </div>

      {toutiaoUser?.available !== false && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">头条号:</span>
            {toutiaoUser?.loggedIn ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-green-700 font-medium">{toutiaoUser.username || '已登录'}</span>
                <button
                  onClick={handleToutiaoLogout}
                  className="text-xs text-gray-400 hover:text-red-500 ml-1"
                >
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm text-gray-500">未登录</span>
                <button
                  onClick={handleToutiaoLogin}
                  disabled={loginLoading}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {loginLoading ? '等待扫码...' : '登录头条'}
                </button>
              </div>
            )}
          </div>
          {toutiaoUser?.loggedIn && selected.size > 0 && (
            <button
              onClick={handlePublishDrafts}
              disabled={publishing}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {publishing ? '同步中...' : `同步 ${selected.size} 篇到草稿箱`}
            </button>
          )}
        </div>
      )}

      {publishResults && (
        <div className="mb-4 p-4 rounded-xl border text-sm space-y-2 bg-white">
          <div className="font-medium mb-2">
            发布结果: {publishResults.filter((r) => r.success).length} 成功 / {publishResults.filter((r) => !r.success).length} 失败
          </div>
          {publishResults.map((r) => (
            <div
              key={r.articleId}
              className={`flex items-center justify-between py-1.5 px-2 rounded ${
                r.success ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                {r.success ? '✓' : '✗'} {r.title}
              </span>
              {r.draftUrl && (
                <a href={r.draftUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                  查看草稿 ↗
                </a>
              )}
              {r.error && <span className="text-xs text-red-500 max-w-xs truncate">{r.error}</span>}
            </div>
          ))}
        </div>
      )}

      {exported && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          已导出到: <code className="bg-green-100 px-1 rounded">{exported}</code>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {showLogs && (
        <div className="mb-6 bg-gray-900 text-gray-300 rounded-xl p-4 max-h-64 overflow-y-auto text-xs font-mono">
          {task.logs.map((log, i) => (
            <div key={i} className={`py-0.5 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : ''}`}>
              <span className="text-gray-500">{new Date(log.time).toLocaleTimeString('zh-CN')}</span>{' '}
              <span className={`uppercase ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                [{log.level}]
              </span>{' '}
              {log.message}
            </div>
          ))}
        </div>
      )}

      {/* Content type tabs: All / Article / Video */}
      <div className="mb-3 flex gap-2">
        {([
          { key: 'all' as ContentType, label: '全部', count: task.candidates.length },
          { key: 'article' as ContentType, label: '文章', icon: '📝', count: contentTypeStats.article },
          { key: 'video' as ContentType, label: '视频', icon: '🎥', count: contentTypeStats.video },
        ]).map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => setContentType(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              contentType === key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {icon && <span className="mr-1">{icon}</span>}
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Category filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部分类
        </button>
        {ALL_CATEGORIES.filter((cat) => categoryStats[cat]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CategoryIcon category={cat} /> {cat} ({categoryStats[cat]})
          </button>
        ))}
      </div>

      {/* Source filter tabs */}
      {Object.keys(sourceStats).length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 mr-1">来源:</span>
          <button
            onClick={() => setActiveSource('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeSource === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            全部 ({task?.candidates.length || 0})
          </button>
          {Object.entries(sourceStats)
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => (
            <button
              key={src}
              onClick={() => setActiveSource(src)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeSource === src
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {src} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredCandidates.map((article) => (
          <CandidateCard
            key={article.id}
            article={article}
            selected={selected.has(article.id)}
            expanded={expandedId === article.id}
            onToggle={() => toggleSelect(article.id)}
            onExpand={() => setExpandedId(expandedId === article.id ? null : article.id)}
            taskId={id!}
            onRewrite={(platform?: string) => handleRewrite(article.id, platform)}
            onTitleUpdate={(articleId, newTitle) => {
              setTask((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  candidates: prev.candidates.map((c) =>
                    c.id === articleId ? { ...c, title: newTitle } : c
                  ),
                };
              });
            }}
          />
        ))}
      </div>

      {filteredCandidates.length === 0 && task.candidates.length > 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>该分类下没有内容</p>
        </div>
      )}

      {task.candidates.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p>没有候选内容</p>
          <p className="text-sm mt-1">可能所有内容都被筛选掉了，尝试调低筛选标准</p>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  article,
  selected,
  expanded,
  onToggle,
  onExpand,
  taskId,
  onRewrite,
  onTitleUpdate,
}: {
  article: CandidateArticle;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  taskId: string;
  onRewrite: (platform?: string) => void;
  onTitleUpdate: (articleId: string, newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(article.title);
  const [saving, setSaving] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || editTitle === article.title) {
      setEditing(false);
      setEditTitle(article.title);
      return;
    }
    setSaving(true);
    try {
      await api.updateArticleTitle(taskId, article.id, editTitle.trim());
      onTitleUpdate(article.id, editTitle.trim());
      setEditing(false);
    } catch {
      setEditTitle(article.title);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') { setEditing(false); setEditTitle(article.title); }
  };

  const imgCount = article.images?.length || 0;
  const thumbUrl = article.imageUrl || (article.images && article.images[0]);

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-colors ${
        selected ? 'border-brand-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <ScoreBadge score={article.topicScore} />
              <CategoryBadge category={article.category} />
              {article.videoUrl && (
                <span className="score-badge bg-pink-100 text-pink-700">▶ 视频</span>
              )}
              {imgCount > 0 && (
                <span className="score-badge bg-blue-50 text-blue-600">🖼 {imgCount}图</span>
              )}
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {article.source}
              </span>
              {article.rewriteStatus === 'done' && (
                <span className="score-badge bg-green-100 text-green-700">✓ 已重写</span>
              )}
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveTitle}
                  autoFocus
                  disabled={saving}
                  className="flex-1 px-2 py-1 border border-brand-300 rounded-lg text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={saving}
                  className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving ? '...' : '保存'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditTitle(article.title); }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold text-gray-900 cursor-pointer hover:text-brand-600 flex-1"
                  onClick={onExpand}
                >
                  {article.title}
                </h3>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                  className="px-2 py-0.5 text-xs text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded border border-transparent hover:border-brand-200 transition-all shrink-0"
                  title="编辑标题"
                >
                  ✏️ 改标题
                </button>
              </div>
            )}
            <div className="flex gap-3 mt-1">
              <p className="text-sm text-gray-500 line-clamp-2 flex-1">{article.summary}</p>
              {!expanded && thumbUrl && !article.videoUrl && (
                <img
                  src={proxyUrl(thumbUrl)}
                  alt=""
                  className="w-28 h-20 object-cover rounded-lg shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  onClick={onExpand}
                />
              )}
            </div>
            {!expanded && article.imageUrl && article.videoUrl && (
              <div className="mt-2 relative rounded-lg overflow-hidden cursor-pointer group" style={{ maxHeight: '160px' }}>
                <img
                  src={article.imageUrl}
                  alt=""
                  className="w-full object-cover rounded-lg"
                  style={{ maxHeight: '160px' }}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  onClick={onExpand}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors" onClick={onExpand}>
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <span className="text-lg ml-0.5">▶</span>
                  </div>
                </div>
              </div>
            )}
            {article.scoreReasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {article.scoreReasons.map((r, i) => (
                  <span key={i} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                    {r}
                  </span>
                ))}
              </div>
            )}

            {/* Rewrite button row with platform selector */}
            <div className="flex items-center gap-2 mt-2 relative">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (article.rewriteStatus === 'pending') return;
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    setMenuAbove(spaceBelow < 300);
                    setShowPlatformMenu(!showPlatformMenu);
                  }}
                  disabled={article.rewriteStatus === 'pending'}
                  className="px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100 hover:border-violet-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {article.rewriteStatus === 'pending' ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      重写中...
                    </span>
                  ) : article.rewriteStatus === 'failed' ? (
                    '🔄 重试重写 ▾'
                  ) : article.rewriteStatus === 'done' ? (
                    '🤖 重新改写 ▾'
                  ) : (
                    '🤖 AI 改写 ▾'
                  )}
                </button>
                {showPlatformMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPlatformMenu(false)} />
                    <div className={`absolute left-0 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px] ${
                      menuAbove ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}>
                      <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">选择平台风格</div>
                      {PLATFORM_OPTIONS.map((p) => (
                        <button
                          key={p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPlatformMenu(false);
                            onRewrite(p.id);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
                        >
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {article.rewriteStatus === 'done' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRewrite(!showRewrite); }}
                  className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-all"
                >
                  {showRewrite ? '隐藏重写内容' : '查看重写内容'}
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand-500 text-sm"
              title="查看原文"
            >
              ↗
            </a>
          </div>
        </div>
      </div>

      {/* Rewrite content panel */}
      {showRewrite && article.rewriteStatus === 'done' && article.rewrittenContent && (
        <RewritePanel
          title={article.rewrittenTitle}
          content={article.rewrittenContent}
          images={article.images}
        />
      )}

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl">
          {article.videoUrl && (
            <VideoEmbed url={article.videoUrl} imageUrl={article.imageUrl} />
          )}

          {/* Image gallery */}
          {(article.images?.length ?? 0) > 0 && !article.videoUrl && (
            <div className="mb-4 flex flex-wrap gap-2">
              {article.images!.slice(0, 6).map((img, i) => (
                <img
                  key={i}
                  src={proxyUrl(img)}
                  alt=""
                  className="h-24 rounded-lg object-cover border border-gray-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
              {(article.images?.length ?? 0) > 6 && (
                <div className="h-24 w-24 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                  +{article.images!.length - 6}
                </div>
              )}
            </div>
          )}

          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
            {article.content}
          </div>
          <div className="mt-3 text-xs text-gray-400">
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              原文链接
            </a>
            {article.publishedAt && <span className="ml-3">{article.publishedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-gray-100 text-gray-600';
  if (score >= 60) color = 'bg-red-100 text-red-700';
  else if (score >= 40) color = 'bg-orange-100 text-orange-700';
  else if (score >= 20) color = 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`score-badge ${color}`}>
      {score}分
    </span>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  '社会': 'bg-blue-100 text-blue-700',
  '娱乐': 'bg-purple-100 text-purple-700',
  '科技': 'bg-cyan-100 text-cyan-700',
  '财经': 'bg-emerald-100 text-emerald-700',
  '体育': 'bg-green-100 text-green-700',
  '生活': 'bg-pink-100 text-pink-700',
  '视频': 'bg-rose-100 text-rose-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const CATEGORY_ICONS: Record<string, string> = {
  '社会': '📰',
  '娱乐': '🎬',
  '科技': '💻',
  '财经': '💰',
  '体育': '⚽',
  '生活': '🏠',
  '视频': '🎥',
  '其他': '📌',
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`score-badge ${CATEGORY_COLORS[category] || CATEGORY_COLORS['其他']}`}>
      {CATEGORY_ICONS[category] || '📌'} {category}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  return <span>{CATEGORY_ICONS[category] || '📌'}</span>;
}

const PROXY_BASE = '/api/image-proxy?url=';

function proxyUrl(url: string): string {
  return `${PROXY_BASE}${encodeURIComponent(url)}`;
}

function RewritePanel({ title, content, images }: { title?: string; content: string; images?: string[] }) {
  const [copied, setCopied] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  const validImages = (images || []).filter((u) => u.startsWith('http'));

  const handleCopyAll = async () => {
    const plainText = (title ? `${title}\n\n` : '') + content.replace(/\*\*/g, '').replace(/^>\s?/gm, '').replace(/^---$/gm, '').replace(/^#+\s*/gm, '');
    try {
      const bodyHtml = document.querySelector('.rewrite-content-body')?.innerHTML || '';
      const imgsHtml = validImages.map((img) =>
        `<p><img src="${proxyUrl(img)}" style="max-width:100%;height:auto;" /></p>`
      ).join('');
      const fullHtml = `<h2>${title || ''}</h2>${bodyHtml}${imgsHtml}`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTitle = async () => {
    if (!title) return;
    await navigator.clipboard.writeText(title);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  return (
    <div className="border-t border-violet-100 p-4 bg-violet-50/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-violet-800">AI 重写版本</span>
          {title && (
            <span className="text-xs text-violet-500">标题已重写</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              copied
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-100 hover:border-violet-300'
            }`}
          >
            {copied ? '已复制（含图片）' : '复制全文+图片'}
          </button>
        </div>
      </div>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-bold text-gray-900 text-lg flex-1">{title}</h4>
          <button
            onClick={handleCopyTitle}
            className={`px-2 py-1 text-xs rounded border transition-all shrink-0 ${
              copiedTitle
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'text-gray-400 border-gray-200 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50'
            }`}
          >
            {copiedTitle ? '已复制' : '复制标题'}
          </button>
        </div>
      )}
      <div className="rewrite-content-body prose prose-base max-w-none text-gray-700 leading-[1.9] prose-p:my-4 prose-strong:text-gray-900 prose-strong:font-bold prose-blockquote:border-violet-300 prose-blockquote:bg-violet-50/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:my-4 prose-hr:border-violet-200 prose-hr:my-6">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {validImages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-violet-200">
          <div className="text-xs text-violet-500 font-medium mb-2">
            原文配图（{validImages.length}张，复制时一并包含）
          </div>
          <div className="flex flex-wrap gap-2">
            {validImages.map((img, i) => (
              <img
                key={i}
                src={proxyUrl(img)}
                alt={`配图${i + 1}`}
                className="h-24 rounded-lg object-cover border border-violet-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function extractBvid(url: string): string | null {
  const match = url.match(/bilibili\.com\/video\/(BV[\w]+)/);
  return match ? match[1] : null;
}

function VideoEmbed({ url, imageUrl }: { url: string; imageUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const bvid = extractBvid(url);

  if (bvid && playing) {
    return (
      <div className="mb-4 rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={`https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=1`}
          className="w-full h-full"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className="mb-4">
      {imageUrl ? (
        <div
          className="relative rounded-lg overflow-hidden cursor-pointer group"
          style={{ aspectRatio: '16/9' }}
          onClick={() => bvid ? setPlaying(true) : window.open(url, '_blank')}
        >
          <img
            src={imageUrl}
            alt="视频封面"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <span className="text-2xl ml-1">▶</span>
            </div>
          </div>
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg border border-pink-200 hover:border-pink-300 transition-colors"
        >
          <span className="text-3xl">🎥</span>
          <div>
            <div className="font-medium text-pink-700">观看视频</div>
            <div className="text-xs text-pink-500 mt-0.5 truncate max-w-md">{url}</div>
          </div>
          <span className="ml-auto text-pink-400">↗</span>
        </a>
      )}
    </div>
  );
}
