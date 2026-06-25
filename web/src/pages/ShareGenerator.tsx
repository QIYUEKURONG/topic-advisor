import { useState, useRef, useEffect, useCallback } from 'react';
import {
  api, createShareSSE,
  type GeneratedShare, type ComicStyle, type GeneratedComic, type TrendingRepo,
  COMIC_STYLE_OPTIONS,
} from '../lib/api';

const PHASE_LABELS: Record<string, string> = {
  scrape: '抓取内容',
  generate: '生成文章',
  comics: '生成漫画',
  done: '完成',
};

const ARTICLE_STYLES = [
  { id: 'popular', label: '科普通俗', emoji: '📖', desc: '像给朋友科普一样，通俗易懂' },
  { id: 'deep', label: '技术深度', emoji: '🔬', desc: '深入原理，适合技术读者' },
  { id: 'humor', label: '轻松幽默', emoji: '😄', desc: '段子手风格，让人笑着学到知识' },
  { id: 'xiaohongshu', label: '小红书种草', emoji: '📕', desc: '种草安利风，适合社交媒体' },
  { id: 'news', label: '新闻快报', emoji: '📰', desc: '客观简洁的新闻报道风格' },
] as const;

type ArticleStyle = (typeof ARTICLE_STYLES)[number]['id'];

const EXPORT_PLATFORMS = [
  { id: 'toutiao', label: '头条', icon: '📰' },
  { id: 'wechat', label: '公众号', icon: '💬' },
  { id: 'xiaohongshu', label: '小红书', icon: '📕' },
  { id: 'zhihu', label: '知乎', icon: '🔍' },
  { id: 'douyin', label: '抖音', icon: '🎵' },
  { id: 'weibo', label: '微博', icon: '🔥' },
  { id: 'markdown', label: 'Markdown', icon: '📝' },
];

export default function ShareGenerator() {
  const [url, setUrl] = useState('');
  const [articleStyle, setArticleStyle] = useState<ArticleStyle>('popular');
  const [enableComics, setEnableComics] = useState(true);
  const [comicStyle, setComicStyle] = useState<ComicStyle>('cute');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ phase: '', detail: '', value: 0, total: 0 });
  const [error, setError] = useState('');
  const [share, setShare] = useState<GeneratedShare | null>(null);
  const [linkedComic, setLinkedComic] = useState<GeneratedComic | null>(null);
  const [history, setHistory] = useState<GeneratedShare[]>([]);
  const [copyTip, setCopyTip] = useState('');
  const [exportTip, setExportTip] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trendingRepos, setTrendingRepos] = useState<TrendingRepo[]>([]);
  const [trendingSince, setTrendingSince] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    api.listShares().then(setHistory).catch(() => {});
    return () => { esRef.current?.close(); };
  }, []);

  const fetchTrending = useCallback(async (since: 'daily' | 'weekly' | 'monthly' = trendingSince) => {
    setTrendingLoading(true);
    try {
      const repos = await api.getGitHubTrending(since);
      setTrendingRepos(repos);
      setShowTrending(true);
    } catch (err: any) {
      setError(err.message || '获取热点失败');
    } finally {
      setTrendingLoading(false);
    }
  }, [trendingSince]);

  function handleGenerate() {
    if (!url.trim() || generating) return;
    setGenerating(true);
    setError('');
    setShare(null);
    setLinkedComic(null);
    setProgress({ phase: 'scrape', detail: '准备中...', value: 0, total: 2 });

    esRef.current?.close();
    esRef.current = createShareSSE(url.trim(), enableComics, comicStyle, articleStyle, (evt) => {
      if (evt.type === 'progress') {
        setProgress({
          phase: evt.data.phase,
          detail: evt.data.detail,
          value: evt.data.progress,
          total: evt.data.total,
        });
      } else if (evt.type === 'complete') {
        setGenerating(false);
        api.getShare(evt.data.shareId).then(async (s) => {
          setShare(s);
          if (s.comicId) {
            try {
              const c = await api.getComic(s.comicId);
              setLinkedComic(c);
            } catch {}
          }
          api.listShares().then(setHistory).catch(() => {});
        });
      } else if (evt.type === 'error') {
        setGenerating(false);
        setError(evt.data.message || '生成失败');
      }
    });
  }

  async function loadShare(s: GeneratedShare) {
    setShare(s);
    setUrl(s.url);
    setLinkedComic(null);
    if (s.comicId) {
      try {
        const c = await api.getComic(s.comicId);
        setLinkedComic(c);
      } catch {}
    }
  }

  function copyArticleText() {
    if (!share) return;
    const { article } = share;
    const text = [
      article.title,
      '',
      article.hook,
      '',
      ...article.sections.flatMap(s => [
        `## ${s.heading}`,
        '',
        s.body,
        '',
      ]),
      article.conclusion,
      '',
      ...(share.url ? [`项目地址: ${share.url}`, ''] : []),
      article.tags.map(t => `#${t}`).join(' '),
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopyTip('已复制到剪贴板');
      setTimeout(() => setCopyTip(''), 2000);
    });
  }

  async function handleExport(platform: string) {
    if (!share || exporting) return;
    setShowExportMenu(false);
    setExporting(true);
    setExportTip('');
    try {
      const res = await api.exportShare(share.id, platform);
      setExportTip(`已导出到: ${res.exportDir}`);
      setTimeout(() => setExportTip(''), 5000);
    } catch (err: any) {
      setExportTip(`导出失败: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyWithImages() {
    if (!share) return;
    const { article, scraped } = share;
    const images = scraped.images || [];

    const plainText = [
      article.title, '', article.hook, '',
      ...article.sections.flatMap(s => [`## ${s.heading}`, '', s.body, '']),
      article.conclusion, '',
      ...(share.url ? [`项目地址: ${share.url}`, ''] : []),
      article.tags.map(t => `#${t}`).join(' '),
    ].join('\n');

    try {
      const sectionsHtml = article.sections.map((sec, i) => {
        const bodyHtml = sec.body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
        const imgInterval = article.sections.length > 0 && images.length > 0
          ? Math.max(1, Math.floor(article.sections.length / images.length)) : 0;
        const imgIdx = imgInterval > 0 && (i + 1) % imgInterval === 0
          ? Math.floor((i + 1) / imgInterval) - 1 : -1;
        const imgHtml = imgIdx >= 0 && imgIdx < images.length
          ? `<p><img src="${images[imgIdx]}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" /></p>` : '';
        return `<h3>${sec.heading}</h3><p>${bodyHtml}</p>${imgHtml}`;
      }).join('');

      const urlHtml = share.url ? `<p>项目地址: <a href="${share.url}">${share.url}</a></p>` : '';
      const fullHtml = `<h2>${article.title}</h2><blockquote>${article.hook}</blockquote>${sectionsHtml}<p><strong>${article.conclusion}</strong></p>${urlHtml}<p>${article.tags.map(t => `#${t}`).join(' ')}</p>`;
      const htmlBlob = new Blob([fullHtml], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pct = progress.total > 0 ? Math.round((progress.value / progress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">分享生成器</h2>
      <p className="text-gray-500 text-sm mb-6">
        输入 GitHub 仓库或文章链接，AI 自动生成通俗易懂的分享内容，搭配漫画插图
      </p>

      {/* ── Input ── */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">目标链接</label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo 或 论文/文章链接"
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            disabled={generating}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !url.trim()}
            className="px-6 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-brand-600 transition-colors whitespace-nowrap"
          >
            {generating ? '生成中...' : '开始生成'}
          </button>
        </div>

        {/* Article Style */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">文章风格</label>
          <div className="flex flex-wrap gap-2">
            {ARTICLE_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setArticleStyle(s.id)}
                disabled={generating}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-50 ${
                  articleStyle === s.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
                title={s.desc}
              >
                <span>{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableComics}
              onChange={e => setEnableComics(e.target.checked)}
              className="rounded"
              disabled={generating}
            />
            <span>同时生成漫画插图</span>
          </label>

          {enableComics && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">漫画风格:</span>
              <select
                value={comicStyle}
                onChange={e => setComicStyle(e.target.value as ComicStyle)}
                className="border rounded-lg px-3 py-1.5 text-sm"
                disabled={generating}
              >
                {COMIC_STYLE_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── GitHub Trending ── */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub 热点项目
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={trendingSince}
              onChange={e => {
                const v = e.target.value as 'daily' | 'weekly' | 'monthly';
                setTrendingSince(v);
                if (showTrending) fetchTrending(v);
              }}
              className="border rounded-lg px-2 py-1 text-xs"
            >
              <option value="daily">今日</option>
              <option value="weekly">本周</option>
              <option value="monthly">本月</option>
            </select>
            <button
              onClick={() => fetchTrending()}
              disabled={trendingLoading}
              className="px-3 py-1 bg-gray-800 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              {trendingLoading ? '加载中...' : showTrending ? '刷新' : '获取热点'}
            </button>
          </div>
        </div>

        {showTrending && trendingRepos.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {trendingRepos.map(repo => (
              <div
                key={repo.fullName}
                className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                onClick={() => {
                  setUrl(repo.url);
                }}
              >
                <span className="text-xs text-gray-400 font-mono w-5 text-right flex-shrink-0 mt-0.5">
                  {repo.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-600 group-hover:underline truncate">
                      {repo.fullName}
                    </span>
                    {repo.language && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">
                        {repo.language}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{repo.description || '暂无描述'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  <span title="总星标">&#9733; {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}</span>
                  <span className="text-orange-500 font-medium" title="今日新增">+{repo.todayStars}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {showTrending && trendingRepos.length === 0 && !trendingLoading && (
          <p className="text-sm text-gray-400 text-center py-4">暂无数据</p>
        )}
      </div>

      {/* ── Progress ── */}
      {generating && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{PHASE_LABELS[progress.phase] || progress.phase}</span>
            <span className="text-gray-500">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-brand-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{progress.detail}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* ── Result ── */}
      {share && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Article */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{share.article.title}</h3>
              <div className="flex items-center gap-2">
                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exporting}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 bg-white hover:bg-green-50 hover:border-green-300 transition-all disabled:opacity-50"
                  >
                    {exporting ? '导出中...' : '导出 ▾'}
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute right-0 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px] top-full mt-1">
                        <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">选择导出格式</div>
                        {EXPORT_PLATFORMS.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleExport(p.id)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:text-green-700 transition-colors flex items-center gap-2"
                          >
                            <span>{p.icon}</span>
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Copy with images */}
                <button
                  onClick={handleCopyWithImages}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    copied
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50 hover:border-brand-300'
                  }`}
                >
                  {copied ? '已复制（含图片）' : '复制全文+图片'}
                </button>
                {/* Copy plain text */}
                <button
                  onClick={copyArticleText}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  {copyTip || '复制纯文本'}
                </button>
              </div>
            </div>
            {exportTip && (
              <div className={`mb-3 p-2.5 rounded-lg text-xs ${
                exportTip.startsWith('已导出') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {exportTip}
              </div>
            )}

            <p className="text-gray-600 italic mb-4 text-sm border-l-4 border-brand-300 pl-3">
              {share.article.hook}
            </p>

            {share.article.sections.map((sec, i) => {
              const imgs = share.scraped.images || [];
              const sectionCount = share.article.sections.length;
              const imgInterval = sectionCount > 0 && imgs.length > 0
                ? Math.max(1, Math.floor(sectionCount / imgs.length))
                : 0;
              const imgIndex = imgInterval > 0 && (i + 1) % imgInterval === 0
                ? Math.floor((i + 1) / imgInterval) - 1
                : -1;
              const inlineImg = imgIndex >= 0 && imgIndex < imgs.length ? imgs[imgIndex] : null;

              return (
                <div key={i} className="mb-5">
                  <h4 className="font-semibold text-base mb-2">{sec.heading}</h4>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: sec.body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
                    }}
                  />
                  {linkedComic && linkedComic.finalImages[i] && (
                    <div className="mt-3">
                      <img
                        src={api.getComicImageUrl(linkedComic.id, linkedComic.finalImages[i], linkedComic.version)}
                        alt={sec.heading}
                        className="rounded-lg max-w-full shadow-sm border"
                        style={{ maxHeight: 300 }}
                      />
                    </div>
                  )}
                  {inlineImg && (
                    <a href={inlineImg} target="_blank" rel="noopener noreferrer" className="block mt-4">
                      <img
                        src={inlineImg}
                        alt={`Demo ${imgIndex + 1}`}
                        className="rounded-lg border max-w-full shadow-sm hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                  )}
                </div>
              );
            })}

            <p className="text-gray-800 font-medium mt-4 pt-4 border-t">
              {share.article.conclusion}
            </p>

            {share.url && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs text-gray-500 block mb-1">项目地址</span>
                <a
                  href={share.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {share.url}
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {share.article.tags.map((tag, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Sidebar: source info */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h4 className="font-semibold text-sm mb-3">来源信息</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">类型: </span>
                  <span className="font-medium">
                    {share.urlType === 'github' ? 'GitHub 项目' : share.urlType === 'paper' ? '论文' : '文章'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">标题: </span>
                  <span className="font-medium">{share.scraped.title}</span>
                </div>
                {share.scraped.description && (
                  <div>
                    <span className="text-gray-500">描述: </span>
                    <span>{share.scraped.description}</span>
                  </div>
                )}
                {Object.entries(share.scraped.meta)
                  .filter(([, v]) => v !== '' && v !== 0 && v !== 'N/A')
                  .map(([k, v]) => (
                    <div key={k}>
                      <span className="text-gray-500">{k}: </span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
              </div>
              <a
                href={share.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-sm text-brand-500 hover:underline"
              >
                查看原始链接
              </a>
            </div>


            {linkedComic && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h4 className="font-semibold text-sm mb-3">配套漫画</h4>
                <div className="grid grid-cols-2 gap-2">
                  {linkedComic.finalImages.map((img, i) => (
                    <img
                      key={i}
                      src={api.getComicImageUrl(linkedComic.id, img, linkedComic.version)}
                      alt={`Comic ${i + 1}`}
                      className="rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </div>
                <a
                  href={`/stickers`}
                  className="inline-block mt-3 text-sm text-brand-500 hover:underline"
                >
                  在漫画工坊中编辑
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold mb-3">历史记录</h3>
          <div className="divide-y">
            {history.map(s => (
              <button
                key={s.id}
                onClick={() => loadShare(s)}
                className={`w-full text-left py-3 px-2 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                  share?.id === s.id ? 'bg-brand-50' : ''
                }`}
              >
                <span className="text-lg">
                  {s.urlType === 'github' ? '🐙' : s.urlType === 'paper' ? '📄' : '🔗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.article.title}</p>
                  <p className="text-xs text-gray-400 truncate">{s.url}</p>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString('zh-CN')}
                </div>
                {s.comicId && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">含漫画</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
