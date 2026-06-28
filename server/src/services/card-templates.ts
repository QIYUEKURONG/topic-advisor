export interface CardItem {
  title: string;
  keyword: string;
  desc: string;
  icon: string;
}

export interface CardCustomTheme {
  bgColor?: string;
  cardBgColor?: string;
  accentColor?: string;
  textColor?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'double' | 'none';
  borderWidth?: number;
  titleFontSize?: number;
  itemFontSize?: number;
  showTexture?: boolean;
  showDecorations?: boolean;
  showPageInfo?: boolean;
  showFooter?: boolean;
  cornerRadius?: number;
  iconSize?: number;
}

export interface CardData {
  mainTitle: string;
  subtitle?: string;
  items: CardItem[];
  footer?: string;
  style: CardStyle;
  pageInfo?: string;
  customTheme?: CardCustomTheme;
}

export type CardStyle = 'retro' | 'modern' | 'minimal' | 'warm' | 'dark-orange' | 'ocean' | 'forest' | 'rose' | 'purple' | 'sunset' | 'mint' | 'coffee';
export type CardLayout = 'grid-36' | 'grid-12' | 'grid-9' | 'grid-6' | 'list-6' | 'list-8' | 'list-10';

interface StyleTheme {
  bg: string;
  cardBg: string;
  accent: string;
  text: string;
  textLight: string;
  border: string;
  titleFont: string;
  hasTexture: boolean;
}

const STYLE_CSS: Record<CardStyle, StyleTheme> = {
  retro: {
    bg: '#f5efe0',
    cardBg: '#faf6ed',
    accent: '#c75c2e',
    text: '#3d2e1c',
    textLight: '#7a6a55',
    border: '#d4c4a8',
    titleFont: '"STKaiti", "KaiTi", "PingFang SC", serif',
    hasTexture: true,
  },
  warm: {
    bg: '#fef8ef',
    cardBg: '#fffcf5',
    accent: '#e07c24',
    text: '#4a3728',
    textLight: '#8a7a6a',
    border: '#f0dcc8',
    titleFont: '"STKaiti", "KaiTi", "PingFang SC", serif',
    hasTexture: true,
  },
  'dark-orange': {
    bg: '#2c1810',
    cardBg: '#3d2a1e',
    accent: '#e8883a',
    text: '#f0e6d8',
    textLight: '#b8a896',
    border: '#5a4030',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  modern: {
    bg: '#1a1a2e',
    cardBg: '#22223a',
    accent: '#e94560',
    text: '#eaeaea',
    textLight: '#9a9ab0',
    border: '#2a2a4e',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  minimal: {
    bg: '#ffffff',
    cardBg: '#f9fafb',
    accent: '#2563eb',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#e5e7eb',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  ocean: {
    bg: '#eef6fc',
    cardBg: '#f5faff',
    accent: '#0369a1',
    text: '#0c4a6e',
    textLight: '#64748b',
    border: '#bae6fd',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  forest: {
    bg: '#f0fdf4',
    cardBg: '#f7fef9',
    accent: '#15803d',
    text: '#14532d',
    textLight: '#4b7a5a',
    border: '#bbf7d0',
    titleFont: '"STKaiti", "KaiTi", "PingFang SC", serif',
    hasTexture: true,
  },
  rose: {
    bg: '#fff1f2',
    cardBg: '#fff5f6',
    accent: '#e11d48',
    text: '#4c0519',
    textLight: '#9f1239',
    border: '#fecdd3',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  purple: {
    bg: '#f5f3ff',
    cardBg: '#faf8ff',
    accent: '#7c3aed',
    text: '#3b0764',
    textLight: '#6d28d9',
    border: '#c4b5fd',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  sunset: {
    bg: '#fff7ed',
    cardBg: '#fffbf5',
    accent: '#ea580c',
    text: '#7c2d12',
    textLight: '#9a3412',
    border: '#fed7aa',
    titleFont: '"STKaiti", "KaiTi", "PingFang SC", serif',
    hasTexture: true,
  },
  mint: {
    bg: '#f0fdfa',
    cardBg: '#f5fffe',
    accent: '#0d9488',
    text: '#134e4a',
    textLight: '#5eead4',
    border: '#99f6e4',
    titleFont: '"PingFang SC", "Microsoft YaHei", sans-serif',
    hasTexture: false,
  },
  coffee: {
    bg: '#faf5f0',
    cardBg: '#fefcfa',
    accent: '#92400e',
    text: '#451a03',
    textLight: '#78716c',
    border: '#d6c4b0',
    titleFont: '"STKaiti", "KaiTi", "PingFang SC", serif',
    hasTexture: true,
  },
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAPER_TEXTURE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`;

interface RenderOpts { bStyle: string; bWidth: number; radius: number; iconSz: number }

function renderGrid36(items: CardItem[], t: StyleTheme, o: RenderOpts): string {
  const cols = 6;
  return `<div style="
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    gap: 0;
    border: ${o.bWidth}px ${o.bStyle} ${t.border};
    border-radius: ${o.radius}px;
    overflow: hidden;
  ">
    ${items.map((item, i) => `
      <div style="
        padding: 14px 10px 10px;
        border-right: ${(i + 1) % cols === 0 ? 'none' : `1px ${o.bStyle} ${t.border}`};
        border-bottom: ${i >= items.length - cols ? 'none' : `1px ${o.bStyle} ${t.border}`};
        display: flex;
        flex-direction: column;
        min-height: 120px;
        position: relative;
      ">
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
          <span style="
            background: ${t.accent};
            color: white;
            font-size: 10px;
            font-weight: 800;
            width: 20px; height: 20px;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          ">${String(i + 1).padStart(2, '0')}</span>
          <span style="font-size: 14px; font-weight: 800; color: ${t.text};">${escHtml(item.title)}：</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: ${t.accent}; margin-bottom: 4px;">
          ${escHtml(item.keyword)}
        </div>
        <div style="font-size: ${o.iconSz}px; text-align: center; margin: 2px 0 4px;">${item.icon}</div>
        <div style="font-size: 10px; color: ${t.textLight}; line-height: 1.5;">
          ${escHtml(item.desc)}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderGrid(items: CardItem[], cols: number, t: StyleTheme, o: RenderOpts): string {
  return `<div style="
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    gap: 12px;
  ">
    ${items.map((item, i) => `
      <div style="
        background: ${t.cardBg};
        border: ${o.bWidth}px ${o.bStyle} ${t.border};
        border-radius: ${o.radius}px;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        position: relative;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="
            background: ${t.accent};
            color: white;
            width: 28px; height: 28px;
            border-radius: 14px;
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 800; flex-shrink: 0;
          ">${String(i + 1).padStart(2, '0')}</span>
          <span style="font-size: 16px; font-weight: 800; color: ${t.text};">${escHtml(item.title)}</span>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: ${t.accent};">
          ${escHtml(item.keyword)}
        </div>
        <div style="font-size: ${o.iconSz}px; text-align: center; margin: 4px 0;">${item.icon}</div>
        <div style="font-size: 12px; color: ${t.textLight}; line-height: 1.6;">
          ${escHtml(item.desc)}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderList(items: CardItem[], t: StyleTheme, o: RenderOpts): string {
  return `<div style="
    border: ${o.bWidth}px ${o.bStyle} ${t.border};
    border-radius: ${o.radius}px;
    overflow: hidden;
  ">
    ${items.map((item, i) => `
      <div style="
        display: flex;
        align-items: center;
        padding: 20px 24px;
        gap: 16px;
        ${i < items.length - 1 ? `border-bottom: ${o.bWidth}px ${o.bStyle} ${t.border};` : ''}
        background: ${i % 2 === 0 ? t.cardBg : t.bg};
      ">
        <span style="
          background: ${t.accent};
          color: white;
          min-width: 40px; height: 40px;
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; font-weight: 800; flex-shrink: 0;
        ">${String(i + 1).padStart(2, '0')}</span>
        <div style="flex: 1;">
          <div style="font-size: 22px; font-weight: 800; color: ${t.text}; margin-bottom: 2px;">
            ${escHtml(item.title)}：<span style="color: ${t.accent};">${escHtml(item.keyword)}</span>
          </div>
          <div style="font-size: 14px; color: ${t.textLight}; line-height: 1.5;">
            ${escHtml(item.desc)}
          </div>
        </div>
        <div style="font-size: ${o.iconSz}px; flex-shrink: 0; opacity: 0.9;">${item.icon}</div>
      </div>
    `).join('')}
  </div>`;
}

export function renderCardHTML(data: CardData, layout: CardLayout): string {
  const base = STYLE_CSS[data.style] || STYLE_CSS.retro;
  const c = data.customTheme || {};
  const t: StyleTheme = {
    bg: c.bgColor || base.bg,
    cardBg: c.cardBgColor || base.cardBg,
    accent: c.accentColor || base.accent,
    text: c.textColor || base.text,
    textLight: base.textLight,
    border: c.borderColor || base.border,
    titleFont: base.titleFont,
    hasTexture: c.showTexture !== undefined ? c.showTexture : base.hasTexture,
  };
  const bStyle = c.borderStyle || 'solid';
  const bWidth = c.borderWidth ?? 2;
  const radius = c.cornerRadius ?? 12;
  const titleSize = c.titleFontSize ?? (layout === 'grid-36' ? 52 : 56);
  const iconSz = c.iconSize ?? (layout === 'grid-36' ? 30 : layout.startsWith('list') ? 48 : 36);
  const showDecor = c.showDecorations !== undefined ? c.showDecorations : t.hasTexture;
  const showPage = c.showPageInfo !== undefined ? c.showPageInfo : !!data.pageInfo;
  const showFoot = c.showFooter !== undefined ? c.showFooter : !!data.footer;
  const width = 1080;

  const renderOpts = { bStyle, bWidth, radius, iconSz };

  let contentHtml: string;
  if (layout === 'grid-36') {
    contentHtml = renderGrid36(data.items, t, renderOpts);
  } else if (layout.startsWith('grid')) {
    const count = parseInt(layout.split('-')[1]);
    const cols = count <= 6 ? 2 : 3;
    contentHtml = renderGrid(data.items, cols, t, renderOpts);
  } else {
    contentHtml = renderList(data.items, t, renderOpts);
  }

  const decorLeft = showDecor ? `
    <div style="position: absolute; top: 20px; left: 20px; font-size: 36px; opacity: 0.3;">✦</div>
    <div style="position: absolute; bottom: 30px; left: 25px; font-size: 28px; opacity: 0.2;">✿</div>
  ` : '';
  const decorRight = showDecor ? `
    <div style="position: absolute; top: 25px; right: 20px; font-size: 30px; opacity: 0.25;">✧</div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    font-family: ${t.titleFont};
    background: ${t.bg};
    ${t.hasTexture ? `background-image: ${PAPER_TEXTURE_SVG};` : ''}
    position: relative;
  }
</style>
</head>
<body>
<div style="padding: 48px 36px; position: relative;">
  ${decorLeft}
  ${decorRight}

  <!-- Page info -->
  ${showPage && data.pageInfo ? `
  <div style="
    position: absolute; top: 32px; right: 36px;
    background: ${t.text}; color: ${t.bg};
    width: 42px; height: 42px; border-radius: 21px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700;
  ">${escHtml(data.pageInfo)}</div>
  ` : ''}

  <!-- Title -->
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="
      font-family: ${t.titleFont};
      font-size: ${titleSize}px;
      font-weight: 900;
      color: ${t.text};
      letter-spacing: 4px;
      line-height: 1.3;
      position: relative;
      display: inline-block;
    ">
      <span style="
        background: linear-gradient(180deg, transparent 60%, ${t.accent}33 60%);
        padding: 0 8px;
      ">${escHtml(data.mainTitle)}</span>
    </h1>
    ${data.subtitle ? `
    <p style="
      font-size: 16px;
      color: ${t.textLight};
      margin-top: 10px;
      letter-spacing: 1px;
    ">${escHtml(data.subtitle)}</p>` : ''}
  </div>

  <!-- Content -->
  ${contentHtml}

  <!-- Footer -->
  ${showFoot && data.footer ? `
  <div style="
    text-align: center;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px dashed ${t.border};
    font-size: 13px;
    color: ${t.textLight};
    letter-spacing: 1px;
  ">✦ ${escHtml(data.footer)} ✦</div>
  ` : ''}
</div>
</body>
</html>`;
}

export const CARD_LAYOUTS: Array<{ id: CardLayout; label: string; itemCount: number; description: string }> = [
  { id: 'grid-36', label: '36格全景', itemCount: 36, description: '6×6 密集网格，适合大量知识点' },
  { id: 'grid-12', label: '12格网格', itemCount: 12, description: '3×4 标准网格' },
  { id: 'grid-9', label: '9格网格', itemCount: 9, description: '3×3 网格布局' },
  { id: 'grid-6', label: '6格网格', itemCount: 6, description: '2×3 网格布局' },
  { id: 'list-6', label: '6条清单', itemCount: 6, description: '详细条目列表' },
  { id: 'list-8', label: '8条清单', itemCount: 8, description: '中等清单' },
  { id: 'list-10', label: '10条清单', itemCount: 10, description: '长清单' },
];

export const CARD_STYLES: Array<{ id: CardStyle; label: string; description: string }> = [
  { id: 'retro', label: '复古纸张', description: '温暖怀旧纸质质感' },
  { id: 'warm', label: '暖橙色系', description: '橙黄暖色清新温暖' },
  { id: 'coffee', label: '咖啡拿铁', description: '咖色棕调文艺气质' },
  { id: 'sunset', label: '日落橘红', description: '夕阳色调热情活力' },
  { id: 'forest', label: '森林绿意', description: '自然绿色清新健康' },
  { id: 'ocean', label: '海洋蓝调', description: '蓝色调冷静专业' },
  { id: 'mint', label: '薄荷清新', description: '薄荷绿轻盈透气' },
  { id: 'rose', label: '玫瑰粉红', description: '粉红系甜美少女' },
  { id: 'purple', label: '梦幻紫境', description: '紫色调神秘优雅' },
  { id: 'minimal', label: '简约白色', description: '干净简洁极简风' },
  { id: 'dark-orange', label: '暗夜橙金', description: '深棕底橙金高级感' },
  { id: 'modern', label: '深蓝科技', description: '深色背景科技感' },
];
