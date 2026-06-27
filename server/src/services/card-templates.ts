export interface CardItem {
  title: string;
  desc: string;
  icon: string;
}

export interface CardData {
  mainTitle: string;
  subtitle?: string;
  items: CardItem[];
  footer?: string;
  style: CardStyle;
}

export type CardStyle = 'retro' | 'modern' | 'minimal' | 'warm';
export type CardLayout = 'grid-6' | 'grid-9' | 'grid-12' | 'list-6' | 'list-10';

const STYLE_CSS: Record<CardStyle, { bg: string; accent: string; text: string; border: string; titleFont: string }> = {
  retro: {
    bg: '#f5efe0',
    accent: '#c75c2e',
    text: '#3d3428',
    border: '#d4c4a8',
    titleFont: '"STKaiti", "KaiTi", serif',
  },
  modern: {
    bg: '#1a1a2e',
    accent: '#e94560',
    text: '#eaeaea',
    border: '#2a2a4e',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  minimal: {
    bg: '#ffffff',
    accent: '#2563eb',
    text: '#1f2937',
    border: '#e5e7eb',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  warm: {
    bg: '#fff8f0',
    accent: '#e07c24',
    text: '#4a3728',
    border: '#f0dcc8',
    titleFont: '"STKaiti", "KaiTi", serif',
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderGridItems(items: CardItem[], cols: number, style: typeof STYLE_CSS['retro']): string {
  return items.map((item, i) => `
    <div style="
      background: ${style.bg};
      border: 1px solid ${style.border};
      border-radius: 12px;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    ">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="
          background: ${style.accent};
          color: white;
          width: 24px; height: 24px;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: bold; flex-shrink: 0;
        ">${String(i + 1).padStart(2, '0')}</span>
        <span style="font-size: 15px; font-weight: 700; color: ${style.text};">${escapeHtml(item.title)}</span>
      </div>
      <div style="font-size: 11px; color: ${style.text}; opacity: 0.7; line-height: 1.5;">
        ${escapeHtml(item.desc)}
      </div>
      <div style="font-size: 28px; text-align: right; opacity: 0.15; margin-top: auto;">${item.icon}</div>
    </div>
  `).join('\n');
}

function renderListItems(items: CardItem[], style: typeof STYLE_CSS['retro']): string {
  return items.map((item, i) => `
    <div style="
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 0;
      ${i < items.length - 1 ? `border-bottom: 1px solid ${style.border};` : ''}
    ">
      <span style="
        background: ${style.accent};
        color: white;
        min-width: 32px; height: 32px;
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: bold; flex-shrink: 0;
      ">${String(i + 1).padStart(2, '0')}</span>
      <div style="flex: 1;">
        <div style="font-size: 16px; font-weight: 700; color: ${style.text}; margin-bottom: 4px;">
          ${item.icon} ${escapeHtml(item.title)}
        </div>
        <div style="font-size: 13px; color: ${style.text}; opacity: 0.65; line-height: 1.6;">
          ${escapeHtml(item.desc)}
        </div>
      </div>
    </div>
  `).join('\n');
}

export function renderCardHTML(data: CardData, layout: CardLayout): string {
  const style = STYLE_CSS[data.style];
  const isGrid = layout.startsWith('grid');
  const cols = isGrid ? parseInt(layout.split('-')[1]) / (parseInt(layout.split('-')[1]) <= 6 ? 2 : 3) : 1;
  const width = 1080;
  const itemsHtml = isGrid
    ? renderGridItems(data.items, cols, style)
    : renderListItems(data.items, style);

  const gridCols = isGrid ? (data.items.length <= 6 ? 2 : 3) : 1;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
    background: ${style.bg};
    ${data.style === 'retro' || data.style === 'warm' ? `
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
    ` : ''}
  }
</style>
</head>
<body>
<div style="padding: 48px 40px;">
  <!-- Title -->
  <div style="text-align: center; margin-bottom: 36px;">
    <h1 style="
      font-family: ${style.titleFont};
      font-size: 42px;
      font-weight: 900;
      color: ${style.accent};
      letter-spacing: 2px;
      line-height: 1.3;
    ">${escapeHtml(data.mainTitle)}</h1>
    ${data.subtitle ? `
    <p style="
      font-size: 15px;
      color: ${style.text};
      opacity: 0.6;
      margin-top: 8px;
    ">${escapeHtml(data.subtitle)}</p>` : ''}
  </div>

  <!-- Items -->
  ${isGrid ? `
  <div style="
    display: grid;
    grid-template-columns: repeat(${gridCols}, 1fr);
    gap: 14px;
  ">
    ${itemsHtml}
  </div>
  ` : `
  <div style="
    background: white;
    border-radius: 16px;
    padding: 8px 24px;
    border: 1px solid ${style.border};
  ">
    ${itemsHtml}
  </div>
  `}

  <!-- Footer -->
  ${data.footer ? `
  <div style="
    text-align: center;
    margin-top: 24px;
    font-size: 12px;
    color: ${style.text};
    opacity: 0.4;
  ">${escapeHtml(data.footer)}</div>
  ` : ''}
</div>
</body>
</html>`;
}

export const CARD_LAYOUTS: Array<{ id: CardLayout; label: string; itemCount: number; description: string }> = [
  { id: 'grid-6', label: '6格网格', itemCount: 6, description: '2×3 网格布局' },
  { id: 'grid-9', label: '9格网格', itemCount: 9, description: '3×3 网格布局' },
  { id: 'grid-12', label: '12格网格', itemCount: 12, description: '3×4 网格布局' },
  { id: 'list-6', label: '6条清单', itemCount: 6, description: '条目列表布局' },
  { id: 'list-10', label: '10条清单', itemCount: 10, description: '长清单布局' },
];

export const CARD_STYLES: Array<{ id: CardStyle; label: string; description: string }> = [
  { id: 'retro', label: '复古纸张', description: '温暖怀旧的纸质质感' },
  { id: 'warm', label: '暖色调', description: '橙黄色系温暖风格' },
  { id: 'modern', label: '深色现代', description: '深蓝背景科技感' },
  { id: 'minimal', label: '简约白色', description: '干净简洁的白色风格' },
];
