import { useState, useEffect, useCallback } from 'react';
import {
  api,
  createStickerSSE,
  type ComicStyle,
  type FontStyle,
  type FontColor,
  type TextLayout,
  type ImageMode,
  type ImageConfig,
  type GeneratedComic,
  COMIC_STYLE_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_COLOR_OPTIONS,
  TEXT_LAYOUT_OPTIONS,
} from '../lib/api';

const TOPIC_PRESETS = [
  { label: '健身运动', topic: '劝人去健身跑步' },
  { label: '自信起来', topic: '我想变的自信起来' },
  { label: '早睡早起', topic: '劝人早睡早起不要熬夜' },
  { label: '快乐生活', topic: '变得快乐的几种方式' },
  { label: '存钱理财', topic: '劝人存钱不要乱花' },
  { label: '读书学习', topic: '劝人多读书学习' },
  { label: '减肥饮食', topic: '劝人减肥控制饮食' },
  { label: '陪伴家人', topic: '劝人多陪伴家人' },
];

interface ProgressState {
  phase: string;
  detail: string;
  progress: number;
  total: number;
}

export default function Stickers() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<ComicStyle>('warm');
  const [fontStyle, setFontStyle] = useState<FontStyle>('default');
  const [fontColor, setFontColor] = useState<FontColor>('white');
  const [textLayout, setTextLayout] = useState<TextLayout>('bar');
  const [imageCount, setImageCount] = useState(3);
  const [imageConfigs, setImageConfigs] = useState<ImageConfig[]>([
    { mode: 'comparison' },
    { mode: 'comparison' },
    { mode: 'normal' },
  ]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [comics, setComics] = useState<GeneratedComic[]>([]);
  const [selectedComic, setSelectedComic] = useState<GeneratedComic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [recomposing, setRecomposing] = useState(false);

  const loadComics = useCallback(async () => {
    try { setComics(await api.listComics()); } catch {}
  }, []);

  useEffect(() => { loadComics(); }, [loadComics]);

  const handleCountChange = (count: number) => {
    setImageCount(count);
    setImageConfigs(prev => {
      const next = [...prev];
      while (next.length < count) next.push({ mode: 'comparison' });
      return next.slice(0, count);
    });
  };

  const toggleMode = (index: number) => {
    setImageConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], mode: next[index].mode === 'comparison' ? 'normal' : 'comparison' };
      return next;
    });
  };

  const handleGenerate = () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setProgress({ phase: 'init', detail: '准备中...', progress: 0, total: 2 + imageCount * 2 + 1 });

    createStickerSSE(topic.trim(), style, fontStyle, fontColor, textLayout, imageConfigs, (event) => {
      if (event.type === 'progress') {
        setProgress(event.data);
      } else if (event.type === 'complete') {
        setGenerating(false);
        setProgress(null);
        loadComics().then(() => {
          api.getComic(event.data.comicId).then(setSelectedComic).catch(() => {});
        });
      } else if (event.type === 'error') {
        setGenerating(false);
        setProgress(null);
        setError(event.data.message);
      }
    });
  };

  const progressPercent = progress ? Math.round((progress.progress / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">漫画贴图工坊</h1>
          <p className="text-gray-500 mt-1">输入主题，AI 自动生成带文字的漫画贴图</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Input Panel */}
          <div className="lg:col-span-1 space-y-5">
            {/* Topic */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">漫画主题</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：劝人去健身跑步、变得快乐的几种方式..."
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={generating}
              />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {TOPIC_PRESETS.map((p) => (
                  <button
                    key={p.topic}
                    onClick={() => setTopic(p.topic)}
                    className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                    disabled={generating}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Count & Mode Config */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                图片数量 <span className="text-gray-400 font-normal">({imageCount} 张)</span>
              </label>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleCountChange(n)}
                    disabled={generating}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      imageCount === n
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">每张图模式</label>
              <div className="space-y-2">
                {imageConfigs.slice(0, imageCount).map((cfg, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">第 {i + 1} 张</span>
                    <button
                      onClick={() => toggleMode(i)}
                      disabled={generating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        cfg.mode === 'comparison'
                          ? 'bg-amber-100 text-amber-700 border border-amber-300'
                          : 'bg-green-100 text-green-700 border border-green-300'
                      }`}
                    >
                      {cfg.mode === 'comparison' ? '对比模式' : '普通模式'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                对比模式: 左右分栏对比 (别问为什么不 vs 要问为什么要)
                <br />
                普通模式: 单张插画配文字说明
              </p>
            </div>

            {/* Style */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">画风选择</label>
              <div className="grid grid-cols-3 gap-2">
                {COMIC_STYLE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    disabled={generating}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all text-xs ${
                      style === s.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span>{s.emoji}</span>
                    <span className="font-medium text-gray-900">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Style */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">文字风格</label>
              <div className="grid grid-cols-3 gap-2">
                {FONT_STYLE_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontStyle(f.id)}
                    disabled={generating}
                    className={`px-2 py-1.5 rounded-lg border text-center transition-all text-xs ${
                      fontStyle === f.id
                        ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{f.label}</div>
                    <div className="text-gray-400 text-[10px]">{f.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Color */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">字体颜色</label>
              <div className="flex gap-2 flex-wrap">
                {FONT_COLOR_OPTIONS.map((fc) => (
                  <button
                    key={fc.id}
                    onClick={() => setFontColor(fc.id)}
                    disabled={generating}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      fontColor === fc.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="inline-block w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: fc.hex }}
                    />
                    <span className="text-gray-700">{fc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Layout */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-3">文字排版</label>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_LAYOUT_OPTIONS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setTextLayout(l.id)}
                    disabled={generating}
                    className={`px-2 py-2 rounded-lg border text-center transition-all text-xs ${
                      textLayout === l.id
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{l.label}</div>
                    <div className="text-gray-400 text-[10px]">{l.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {generating ? '生成中...' : `生成 ${imageCount} 张漫画贴图`}
            </button>

            {/* Progress */}
            {progress && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{progress.detail}</span>
                  <span className="text-xs text-gray-500">{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>脚本</span>
                  <span>提示词</span>
                  <span>画面+文字</span>
                  <span>完成</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <div className="font-medium mb-1">生成失败</div>
                {error}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2">
            {selectedComic && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedComic.script.overallTitle}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{selectedComic.topic}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      {showRaw ? '看成品图' : '看原图'}
                    </button>
                    <button
                      onClick={() => setSelectedComic(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {/* Image grid */}
                <div className={`grid gap-3 ${
                  (showRaw ? selectedComic.rawImages : selectedComic.finalImages).length === 1
                    ? 'grid-cols-1 max-w-lg'
                    : (showRaw ? selectedComic.rawImages : selectedComic.finalImages).length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2 lg:grid-cols-3'
                }`}>
                  {(showRaw ? selectedComic.rawImages : selectedComic.finalImages).map((img, i) => (
                    <div key={img} className="relative group">
                      <img
                        src={api.getComicImageUrl(selectedComic.id, img, selectedComic.version)}
                        alt={`第${i + 1}张`}
                        className="w-full rounded-lg border border-gray-200"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                          selectedComic.script.images[i]?.mode === 'comparison'
                            ? 'bg-amber-500/80'
                            : 'bg-green-500/80'
                        }`}>
                          {selectedComic.script.images[i]?.mode === 'comparison' ? '对比' : '普通'}
                        </span>
                      </div>
                      <a
                        href={api.getComicImageUrl(selectedComic.id, img, selectedComic.version)}
                        download={img}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-1 rounded"
                      >
                        下载
                      </a>
                    </div>
                  ))}
                </div>

                {/* Style switcher */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-semibold text-gray-700 mb-3">切换样式 (不重新生图)</div>
                  <div className="mb-2.5">
                    <div className="text-xs text-gray-500 mb-1">排版</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {TEXT_LAYOUT_OPTIONS.map((l) => (
                        <button
                          key={l.id}
                          disabled={recomposing}
                          onClick={async () => {
                            if (!selectedComic || recomposing) return;
                            setRecomposing(true);
                            setTextLayout(l.id);
                            try {
                              const updated = await api.recomposeComic(selectedComic.id, fontStyle, l.id, fontColor);
                              setSelectedComic(updated);
                              loadComics();
                            } catch (err: any) { setError(err.message); }
                            finally { setRecomposing(false); }
                          }}
                          className={`px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50 ${
                            textLayout === l.id ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2.5">
                    <div className="text-xs text-gray-500 mb-1">字体</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {FONT_STYLE_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          disabled={recomposing}
                          onClick={async () => {
                            if (!selectedComic || recomposing) return;
                            setRecomposing(true);
                            setFontStyle(f.id);
                            try {
                              const updated = await api.recomposeComic(selectedComic.id, f.id, textLayout, fontColor);
                              setSelectedComic(updated);
                              loadComics();
                            } catch (err: any) { setError(err.message); }
                            finally { setRecomposing(false); }
                          }}
                          className={`px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50 ${
                            fontStyle === f.id ? 'bg-purple-50 border-purple-400 text-purple-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">颜色</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {FONT_COLOR_OPTIONS.map((fc) => (
                        <button
                          key={fc.id}
                          disabled={recomposing}
                          onClick={async () => {
                            if (!selectedComic || recomposing) return;
                            setRecomposing(true);
                            setFontColor(fc.id);
                            try {
                              const updated = await api.recomposeComic(selectedComic.id, fontStyle, textLayout, fc.id);
                              setSelectedComic(updated);
                              loadComics();
                            } catch (err: any) { setError(err.message); }
                            finally { setRecomposing(false); }
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50 ${
                            fontColor === fc.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: fc.hex }} />
                          <span className="text-gray-700">{fc.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {recomposing && <p className="text-xs text-purple-500 mt-2">正在重新渲染...</p>}
                </div>

                {/* Download individual images */}
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-semibold text-gray-700 mb-2">下载图片（单张）</div>
                  <div className="flex gap-2 flex-wrap">
                    {(showRaw ? selectedComic.rawImages : selectedComic.finalImages).map((img, i) => (
                      <a
                        key={img}
                        href={api.getComicImageUrl(selectedComic.id, img, selectedComic.version)}
                        download={`${selectedComic.topic}-${i + 1}.png`}
                        className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
                      >
                        第 {i + 1} 张
                      </a>
                    ))}
                  </div>
                </div>

                {/* Export composite (optional) */}
                {selectedComic.finalImages.length > 1 && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-semibold text-gray-700 mb-1">拼接导出（合为一张）</div>
                    <p className="text-xs text-gray-400 mb-2">将多张图拼成一张大图</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['grid', 'vertical', 'horizontal'] as const).map((layout) => (
                        <a
                          key={layout}
                          href={api.getExportUrl(selectedComic.id, layout)}
                          download={`${selectedComic.topic}-${layout}.png`}
                          className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors"
                        >
                          {{ grid: '宫格排版', vertical: '竖向排版', horizontal: '横向排版' }[layout]}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Details */}
                <details className="mt-4">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    查看漫画脚本
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-gray-500">
                      <strong>人物设定:</strong> {selectedComic.script.characterDescription}
                    </div>
                    {selectedComic.script.images.map((img, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="font-medium text-gray-700">
                          第{i + 1}张 — {img.title}
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            img.mode === 'comparison' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {img.mode === 'comparison' ? '对比' : '普通'}
                          </span>
                        </div>
                        {img.mode === 'comparison' ? (
                          <div className="grid grid-cols-2 gap-2 mt-2 text-gray-600">
                            <div className="bg-red-50 rounded p-2">
                              <div className="text-red-600 text-xs font-medium">{img.left?.title}</div>
                              <div className="text-xs mt-1">{img.left?.scene}</div>
                            </div>
                            <div className="bg-green-50 rounded p-2">
                              <div className="text-green-600 text-xs font-medium">{img.right?.title}</div>
                              <div className="text-xs mt-1">{img.right?.scene}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-600 mt-1 text-xs">
                            <div>{img.caption}</div>
                            {img.tips?.map((tip, j) => (
                              <span key={j} className="inline-block bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 mt-1 mr-1">
                                {tip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                历史记录 <span className="text-gray-400 font-normal text-sm">({comics.length})</span>
              </h3>

              {comics.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">🎨</div>
                  <p>还没有生成过漫画</p>
                  <p className="text-sm mt-1">在左侧输入主题，开始创作吧</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {comics.map((comic) => (
                    <button
                      key={comic.id}
                      onClick={() => setSelectedComic(comic)}
                      className={`text-left border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
                        selectedComic?.id === comic.id ? 'ring-2 ring-blue-500' : 'border-gray-200'
                      }`}
                    >
                      {(comic.finalImages?.[0] || comic.rawImages?.[0]) && (
                        <img
                          src={api.getComicImageUrl(comic.id, comic.finalImages?.[0] || comic.rawImages[0], comic.version)}
                          alt={comic.topic}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-2.5">
                        <div className="text-sm font-medium text-gray-900 truncate">{comic.topic}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {comic.finalImages?.length || comic.rawImages?.length || 0} 张 ·{' '}
                          {new Date(comic.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
