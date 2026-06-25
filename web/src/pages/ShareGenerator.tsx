import { useState, useRef, useEffect } from 'react';
import {
  api, createShareSSE,
  type GeneratedShare, type ComicStyle, type GeneratedComic,
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
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    api.listShares().then(setHistory).catch(() => {});
    return () => { esRef.current?.close(); };
  }, []);

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
      article.tags.map(t => `#${t}`).join(' '),
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopyTip('已复制到剪贴板');
      setTimeout(() => setCopyTip(''), 2000);
    });
  }

  async function handleExport() {
    if (!share || exporting) return;
    setExporting(true);
    setExportTip('');
    try {
      const res = await api.exportShare(share.id);
      setExportTip(`已导出到: ${res.exportDir}`);
      setTimeout(() => setExportTip(''), 5000);
    } catch (err: any) {
      setExportTip(`导出失败: ${err.message}`);
    } finally {
      setExporting(false);
    }
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
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="text-sm text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                >
                  {exporting ? '导出中...' : '导出 MD'}
                </button>
                <button
                  onClick={copyArticleText}
                  className="text-sm text-brand-500 hover:text-brand-600 font-medium"
                >
                  {copyTip || '复制全文'}
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
