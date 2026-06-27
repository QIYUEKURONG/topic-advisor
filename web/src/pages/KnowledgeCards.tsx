import { useState, useEffect, useCallback } from 'react';

const BASE = '/api';

interface CardStyle { id: string; label: string; description: string }
interface CardLayout { id: string; label: string; itemCount: number; description: string }
interface CardItem { title: string; desc: string; icon: string }
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

export default function KnowledgeCards() {
  const [styles, setStyles] = useState<CardStyle[]>([]);
  const [layouts, setLayouts] = useState<CardLayout[]>([]);
  const [cards, setCards] = useState<GeneratedCard[]>([]);

  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('retro');
  const [selectedLayout, setSelectedLayout] = useState('grid-6');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [selectedCard, setSelectedCard] = useState<GeneratedCard | null>(null);

  useEffect(() => {
    fetch(`${BASE}/cards/styles`).then((r) => r.json()).then(setStyles).catch(() => {});
    fetch(`${BASE}/cards/layouts`).then((r) => r.json()).then(setLayouts).catch(() => {});
    fetch(`${BASE}/cards`).then((r) => r.json()).then(setCards).catch(() => {});
  }, []);

  const handleGenerate = useCallback(() => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setProgress('开始生成...');
    setSelectedCard(null);

    const params = new URLSearchParams({ topic, style: selectedStyle, layout: selectedLayout });
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
  }, [topic, selectedStyle, selectedLayout, generating]);

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
        <p className="text-sm text-gray-500 mt-1">输入主题，AI 生成内容，自动渲染为精美信息图</p>
      </div>

      {/* Generator Controls */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">主题</label>
            <input
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 text-sm"
              placeholder="例如: 时间管理、36个富人思维、程序员副业指南..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">风格</label>
            <select
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2.5 text-sm"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
            >
              {styles.map((s) => (
                <option key={s.id} value={s.id}>{s.label} - {s.description}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">布局</label>
            <select
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2.5 text-sm"
              value={selectedLayout}
              onChange={(e) => setSelectedLayout(e.target.value)}
            >
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>{l.label} ({l.itemCount}条)</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {generating ? '⏳ 生成中...' : '✨ 生成卡片'}
          </button>
          {progress && <span className="text-sm text-gray-400">{progress}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">预览</h2>
          {selectedCard ? (
            <div>
              <div className="rounded-lg overflow-hidden border border-gray-700 mb-4">
                <img
                  src={`${BASE}/cards/${selectedCard.id}/image`}
                  alt={selectedCard.topic}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(selectedCard.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                >
                  📥 下载 PNG
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
                          alert('已复制到剪贴板！');
                        }
                      });
                    };
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  📋 复制图片
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-20">
              <p className="text-4xl mb-3">📋</p>
              <p>输入主题，点击生成</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">历史记录 ({cards.length})</h2>
          {cards.length === 0 ? (
            <p className="text-gray-500 text-center py-10">还没有生成过卡片</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCard?.id === card.id ? 'bg-brand-500/20 border border-brand-500/30' : 'bg-gray-700/50 hover:bg-gray-700'
                  }`}
                >
                  <img
                    src={`${BASE}/cards/${card.id}/image`}
                    alt={card.topic}
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{card.data.mainTitle}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {card.topic} · {card.layout} · {card.style}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(card.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(card.id); }}
                    className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500"
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
