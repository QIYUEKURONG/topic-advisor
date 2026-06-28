import { useState, useEffect, useCallback } from 'react';

const BASE = '/api';

interface CardStyleOption { id: string; label: string; description: string }
interface CardLayoutOption { id: string; label: string; itemCount: number; description: string }
interface CardItem { title: string; keyword: string; desc: string; icon: string }
interface CardData { mainTitle: string; subtitle?: string; items: CardItem[]; style: string }
interface GeneratedCard {
  id: string;
  topic: string;
  style: string;
  layout: string;
  data: CardData;
  imagePath: string;
  status: string;
  createdAt: string;
}

interface CustomTheme {
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: number;
  titleFontSize?: number;
  showTexture?: boolean;
  showDecorations?: boolean;
  showFooter?: boolean;
  cornerRadius?: number;
  iconSize?: number;
}

const PRESET_COLORS = [
  { label: '复古橙', accent: '#c75c2e', bg: '#f5efe0', text: '#3d2e1c', border: '#d4c4a8' },
  { label: '暖阳橙', accent: '#e07c24', bg: '#fef8ef', text: '#4a3728', border: '#f0dcc8' },
  { label: '日落红', accent: '#ea580c', bg: '#fff7ed', text: '#7c2d12', border: '#fed7aa' },
  { label: '咖啡棕', accent: '#92400e', bg: '#faf5f0', text: '#451a03', border: '#d6c4b0' },
  { label: '海洋蓝', accent: '#0369a1', bg: '#eef6fc', text: '#0c4a6e', border: '#bae6fd' },
  { label: '科技蓝', accent: '#2563eb', bg: '#f0f4ff', text: '#1e293b', border: '#cbd5e1' },
  { label: '薄荷绿', accent: '#0d9488', bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
  { label: '森林绿', accent: '#15803d', bg: '#f0fdf4', text: '#14532d', border: '#bbf7d0' },
  { label: '优雅紫', accent: '#7c3aed', bg: '#f5f3ff', text: '#3b0764', border: '#c4b5fd' },
  { label: '玫瑰粉', accent: '#e11d48', bg: '#fff1f2', text: '#4c0519', border: '#fecdd3' },
  { label: '纯白', accent: '#374151', bg: '#ffffff', text: '#111827', border: '#e5e7eb' },
  { label: '暗夜橙', accent: '#e8883a', bg: '#2c1810', text: '#f0e6d8', border: '#5a4030' },
  { label: '暗夜蓝', accent: '#e94560', bg: '#1a1a2e', text: '#eaeaea', border: '#2a2a4e' },
  { label: '暗夜紫', accent: '#a78bfa', bg: '#1e1030', text: '#e8e0f0', border: '#3d2a60' },
  { label: '暗夜绿', accent: '#34d399', bg: '#0f1f1a', text: '#d1fae5', border: '#1a4035' },
  { label: '纯黑金', accent: '#fbbf24', bg: '#0a0a0a', text: '#f5f5f5', border: '#333333' },
];

const BORDER_STYLES = [
  { id: 'solid', label: '实线' },
  { id: 'dashed', label: '虚线' },
  { id: 'double', label: '双线' },
  { id: 'none', label: '无边框' },
];

export default function KnowledgeCards() {
  const [styles, setStyles] = useState<CardStyleOption[]>([]);
  const [layouts, setLayouts] = useState<CardLayoutOption[]>([]);
  const [cards, setCards] = useState<GeneratedCard[]>([]);

  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('retro');
  const [selectedLayout, setSelectedLayout] = useState('grid-6');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [selectedCard, setSelectedCard] = useState<GeneratedCard | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [customTheme, setCustomTheme] = useState<CustomTheme>({
    borderStyle: 'solid',
    borderWidth: 2,
    cornerRadius: 12,
    showTexture: true,
    showDecorations: true,
    showFooter: true,
    titleFontSize: 52,
    iconSize: 36,
  });

  useEffect(() => {
    fetch(`${BASE}/cards/styles`).then((r) => r.json()).then(setStyles).catch(() => {});
    fetch(`${BASE}/cards/layouts`).then((r) => r.json()).then(setLayouts).catch(() => {});
    fetch(`${BASE}/cards`).then((r) => r.json()).then(setCards).catch(() => {});
  }, []);

  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    setCustomTheme((prev) => ({
      ...prev,
      accentColor: preset.accent,
      bgColor: preset.bg,
      textColor: preset.text,
      borderColor: preset.border,
    }));
  };

  const handleGenerate = useCallback(() => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setProgress('开始生成...');
    setSelectedCard(null);

    const themeToSend = showAdvanced ? customTheme : undefined;
    const params = new URLSearchParams({
      topic,
      style: selectedStyle,
      layout: selectedLayout,
      ...(themeToSend ? { customTheme: JSON.stringify(themeToSend) } : {}),
    });
    const es = new EventSource(`${BASE}/cards/generate?${params}`);

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.message);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      es.close();
      setGenerating(false);
      setProgress('');

      fetch(`${BASE}/cards/${data.cardId}`)
        .then((r) => r.json())
        .then((card: GeneratedCard) => {
          setSelectedCard(card);
          setCards((prev) => [card, ...prev]);
        });
    });

    es.addEventListener('error', (e: any) => {
      try {
        const data = e.data ? JSON.parse(e.data) : { message: '生成失败' };
        setProgress(`错误: ${data.message}`);
      } catch {
        setProgress('连接中断');
      }
      es.close();
      setGenerating(false);
    });
  }, [topic, selectedStyle, selectedLayout, generating, showAdvanced, customTheme]);

  const handleDownload = useCallback((cardId: string) => {
    const link = document.createElement('a');
    link.href = `${BASE}/cards/${cardId}/image`;
    link.download = `card-${cardId}.png`;
    link.click();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📋 知识卡片生成器</h1>
        <p className="text-sm text-gray-500 mt-1">输入主题，AI 生成内容，自动渲染为精美信息图卡</p>
      </div>

      {/* Generator Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        {/* Basic Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">主题</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              placeholder="例如: 时间管理、36个富人思维、副业指南..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">风格</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-400"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
            >
              {styles.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">布局</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-400"
              value={selectedLayout}
              onChange={(e) => setSelectedLayout(e.target.value)}
            >
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>{l.label} ({l.itemCount}条) - {l.description}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium mb-3 flex items-center gap-1"
        >
          <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          {showAdvanced ? '收起高级配置' : '展开高级配置（颜色/边框/字体等）'}
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="border-t border-gray-100 pt-4 space-y-5">
            {/* Color Presets */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">配色方案</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors text-sm"
                    style={{ background: p.bg }}
                  >
                    <span
                      className="w-4 h-4 rounded-full border"
                      style={{ background: p.accent, borderColor: p.border }}
                    />
                    <span style={{ color: p.text }}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">背景色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customTheme.bgColor || '#f5efe0'}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, bgColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customTheme.bgColor || ''}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, bgColor: e.target.value }))}
                    placeholder="#f5efe0"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">强调色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customTheme.accentColor || '#c75c2e'}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customTheme.accentColor || ''}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, accentColor: e.target.value }))}
                    placeholder="#c75c2e"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">文字色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customTheme.textColor || '#3d2e1c'}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, textColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customTheme.textColor || ''}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, textColor: e.target.value }))}
                    placeholder="#3d2e1c"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">边框色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customTheme.borderColor || '#d4c4a8'}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, borderColor: e.target.value }))}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customTheme.borderColor || ''}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, borderColor: e.target.value }))}
                    placeholder="#d4c4a8"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Border & Radius */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">边框样式</label>
                <div className="flex flex-wrap gap-1">
                  {BORDER_STYLES.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setCustomTheme((p) => ({ ...p, borderStyle: b.id }))}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        customTheme.borderStyle === b.id
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  边框粗细: {customTheme.borderWidth}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={customTheme.borderWidth}
                  onChange={(e) => setCustomTheme((p) => ({ ...p, borderWidth: +e.target.value }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  圆角: {customTheme.cornerRadius}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={customTheme.cornerRadius}
                  onChange={(e) => setCustomTheme((p) => ({ ...p, cornerRadius: +e.target.value }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  图标大小: {customTheme.iconSize}px
                </label>
                <input
                  type="range"
                  min={16}
                  max={64}
                  value={customTheme.iconSize}
                  onChange={(e) => setCustomTheme((p) => ({ ...p, iconSize: +e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Title font size */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  标题字号: {customTheme.titleFontSize}px
                </label>
                <input
                  type="range"
                  min={28}
                  max={72}
                  value={customTheme.titleFontSize}
                  onChange={(e) => setCustomTheme((p) => ({ ...p, titleFontSize: +e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customTheme.showTexture}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, showTexture: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  纸张纹理
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customTheme.showDecorations}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, showDecorations: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  装饰元素
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={customTheme.showFooter}
                    onChange={(e) => setCustomTheme((p) => ({ ...p, showFooter: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  底部水印
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="bg-brand-500 text-white px-8 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {generating ? '生成中...' : '生成卡片'}
          </button>
          {progress && <span className="text-sm text-gray-500">{progress}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold mb-4">预览</h2>
          {selectedCard ? (
            <div>
              <div className="rounded-lg overflow-hidden border border-gray-200 mb-4 bg-gray-50">
                <img
                  src={`${BASE}/cards/${selectedCard.id}/image?v=${Date.now()}`}
                  alt={selectedCard.topic}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(selectedCard.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  下载 PNG
                </button>
                <button
                  onClick={() => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = `${BASE}/cards/${selectedCard.id}/image`;
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      ctx?.drawImage(img, 0, 0);
                      canvas.toBlob((blob) => {
                        if (blob) {
                          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        }
                      });
                    };
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  复制图片
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-20 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-5xl mb-3">📋</p>
              <p className="text-lg">输入主题，点击生成</p>
              <p className="text-sm mt-1">支持 36格全景 / 网格 / 清单多种布局</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold mb-4">历史记录 ({cards.length})</h2>
          {cards.length === 0 ? (
            <p className="text-gray-400 text-center py-10">还没有生成过卡片</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCard?.id === card.id ? 'bg-brand-50 border border-brand-300' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <img
                    src={`${BASE}/cards/${card.id}/image`}
                    alt={card.topic}
                    className="w-16 h-16 rounded object-cover flex-shrink-0 border border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-gray-800">{card.data.mainTitle}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {card.topic} · {card.layout} · {card.style}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(card.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(card.id); }}
                    className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    下载
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
