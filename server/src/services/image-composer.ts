import sharp from 'sharp';
import type { ScriptImage, ComicStyle, FontStyle, FontColor, TextLayout } from '../types.js';
import { FONT_STYLES, FONT_COLORS } from '../types.js';

interface Theme {
  titleBg: string;
  titleTextColor: string;
  captionBg: string;
  quoteColor: string;
}

const THEMES: Record<string, Theme> = {
  warm: { titleBg: 'rgba(0,0,0,0.65)', titleTextColor: '#FFFFFF', captionBg: 'rgba(0,0,0,0.52)', quoteColor: '#FFD54F' },
  cute: { titleBg: 'rgba(173,20,87,0.65)', titleTextColor: '#FFFFFF', captionBg: 'rgba(0,0,0,0.52)', quoteColor: '#FCE4EC' },
  business: { titleBg: 'rgba(21,101,192,0.7)', titleTextColor: '#FFFFFF', captionBg: 'rgba(0,0,0,0.52)', quoteColor: '#BBDEFB' },
  retro: { titleBg: 'rgba(62,39,35,0.65)', titleTextColor: '#FFE0B2', captionBg: 'rgba(0,0,0,0.52)', quoteColor: '#FFCC80' },
};
const DEFAULT_THEME: Theme = { titleBg: 'rgba(33,33,33,0.65)', titleTextColor: '#FFFFFF', captionBg: 'rgba(0,0,0,0.48)', quoteColor: '#E0E0E0' };

function getTheme(s: ComicStyle): Theme { return THEMES[s] || DEFAULT_THEME; }
function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function wrap(t: string, mx: number): string[] { const r: string[] = []; let s = t; while (s.length > mx) { r.push(s.slice(0, mx)); s = s.slice(mx); } if (s) r.push(s); return r; }

const BASE_SCALE = 1.4;

type Builder = (img: ScriptImage, w: number, h: number, t: Theme, f: string, c: string, sc: number, lc: string, rc: string) => string;

function barComparison(img: ScriptImage, w: number, h: number, t: Theme, f: string, c: string, sc: number, lc: string, rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const titleH = s(90), barH = s(100), mid = w / 2;
  const copyLines = wrap(img.copyText || '', Math.round(22 / sc / BASE_SCALE));
  const lineH = s(34);
  const copyH = copyLines.length ? copyLines.length * lineH + s(20) : 0;
  const quoteH = img.quote ? s(50) : 0;
  const barY = h - barH - copyH - quoteH;
  const left = img.left?.title || '别问为什么不';
  const right = img.right?.title || '要问为什么要';

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
  <rect x="0" y="0" width="${w}" height="${titleH}" fill="${t.titleBg}"/>
  <text x="${mid}" y="${titleH * 0.6}" text-anchor="middle" font-family="${f}" font-size="${s(46)}" font-weight="700" fill="${c}" filter="url(#ts)">${esc(img.title)}</text>
  <rect x="0" y="${barY}" width="${w}" height="${barH}" fill="${t.captionBg}"/>
  <circle cx="50" cy="${barY + barH / 2}" r="${s(8)}" fill="${lc}"/>
  <text x="70" y="${barY + barH / 2 + s(6)}" font-family="${f}" font-size="${s(30)}" font-weight="600" fill="${lc}" filter="url(#ts)">${esc(left)}</text>
  <line x1="${mid}" y1="${barY + 10}" x2="${mid}" y2="${barY + barH - 10}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <circle cx="${mid + 30}" cy="${barY + barH / 2}" r="${s(8)}" fill="${rc}"/>
  <text x="${mid + 50}" y="${barY + barH / 2 + s(6)}" font-family="${f}" font-size="${s(30)}" font-weight="600" fill="${rc}" filter="url(#ts)">${esc(right)}</text>
  ${copyLines.length ? `<rect x="0" y="${barY + barH}" width="${w}" height="${copyH}" fill="rgba(0,0,0,0.42)"/>
  ${copyLines.map((l, i) => `<text x="${mid}" y="${barY + barH + s(22) + i * lineH}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" fill="${c}" opacity="0.9">${esc(l)}</text>`).join('')}` : ''}
  ${img.quote ? `<rect x="0" y="${h - quoteH}" width="${w}" height="${quoteH}" fill="rgba(0,0,0,0.35)"/>
  <text x="${mid}" y="${h - quoteH / 2 + 6}" text-anchor="middle" font-family="${f}" font-size="${s(22)}" font-style="italic" fill="${t.quoteColor}" opacity="0.85">${esc(img.quote)}</text>` : ''}
</svg>`;
}

function barNormal(img: ScriptImage, w: number, h: number, t: Theme, f: string, c: string, sc: number, _lc: string, _rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const titleH = s(90), mid = w / 2;
  const captionLines = wrap(img.caption || '', Math.round(18 / sc / BASE_SCALE));
  const copyLines = wrap(img.copyText || '', Math.round(22 / sc / BASE_SCALE));
  const tips = img.tips || [];
  const lineH = s(34);
  const captionH = captionLines.length * lineH + s(30);
  const tipsH = tips.length ? tips.length * s(32) + s(10) : 0;
  const copyH = copyLines.length ? copyLines.length * lineH + s(16) : 0;
  const quoteH = img.quote ? s(50) : 0;
  const bottomH = captionH + tipsH + copyH + quoteH;
  const bottomY = h - bottomH;

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
  <rect x="0" y="0" width="${w}" height="${titleH}" fill="${t.titleBg}"/>
  <text x="${mid}" y="${titleH * 0.6}" text-anchor="middle" font-family="${f}" font-size="${s(46)}" font-weight="700" fill="${c}" filter="url(#ts)">${esc(img.title)}</text>
  <rect x="0" y="${bottomY}" width="${w}" height="${captionH + tipsH}" fill="${t.captionBg}"/>
  ${captionLines.map((l, i) => `<text x="${mid}" y="${bottomY + s(30) + i * lineH}" text-anchor="middle" font-family="${f}" font-size="${s(30)}" fill="${c}" filter="url(#ts)">${esc(l)}</text>`).join('')}
  ${tips.map((tip, i) => `<text x="50" y="${bottomY + captionH + i * s(32)}" font-family="${f}" font-size="${s(24)}" fill="${t.quoteColor}">💡 ${esc(tip)}</text>`).join('')}
  ${copyLines.length ? `<rect x="0" y="${bottomY + captionH + tipsH}" width="${w}" height="${copyH}" fill="rgba(0,0,0,0.42)"/>
  ${copyLines.map((l, i) => `<text x="${mid}" y="${bottomY + captionH + tipsH + s(20) + i * lineH}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" fill="${c}" opacity="0.9">${esc(l)}</text>`).join('')}` : ''}
  ${img.quote ? `<rect x="0" y="${h - quoteH}" width="${w}" height="${quoteH}" fill="rgba(0,0,0,0.35)"/>
  <text x="${mid}" y="${h - quoteH / 2 + 6}" text-anchor="middle" font-family="${f}" font-size="${s(22)}" font-style="italic" fill="${t.quoteColor}" opacity="0.85">${esc(img.quote)}</text>` : ''}
</svg>`;
}

function floatingComparison(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, lc: string, rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const left = img.left?.title || '别问为什么不';
  const right = img.right?.title || '要问为什么要';
  const copy = img.copyText || '';

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="heavy"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter>
  </defs>
  <text x="${mid}" y="${s(70)}" text-anchor="middle" font-family="${f}" font-size="${s(56)}" font-weight="800" fill="${c}" filter="url(#heavy)">${esc(img.title)}</text>
  <text x="${w * 0.25}" y="${h - s(100)}" text-anchor="middle" font-family="${f}" font-size="${s(36)}" font-weight="700" fill="${lc}" filter="url(#heavy)">✗ ${esc(left)}</text>
  <text x="${w * 0.75}" y="${h - s(100)}" text-anchor="middle" font-family="${f}" font-size="${s(36)}" font-weight="700" fill="${rc}" filter="url(#heavy)">✓ ${esc(right)}</text>
  ${copy ? `<text x="${mid}" y="${h - s(40)}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" fill="${c}" filter="url(#heavy)">${esc(copy)}</text>` : ''}
  ${img.quote ? `<text x="${mid}" y="${h - s(8)}" text-anchor="middle" font-family="${f}" font-size="${s(20)}" font-style="italic" fill="${c}" filter="url(#heavy)">${esc(img.quote)}</text>` : ''}
</svg>`;
}

function floatingNormal(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, _lc: string, _rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const tips = img.tips || [];

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="heavy"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter>
  </defs>
  <text x="${mid}" y="${s(70)}" text-anchor="middle" font-family="${f}" font-size="${s(56)}" font-weight="800" fill="${c}" filter="url(#heavy)">${esc(img.title)}</text>
  ${img.caption ? `<text x="${mid}" y="${h - s(120)}" text-anchor="middle" font-family="${f}" font-size="${s(32)}" fill="${c}" filter="url(#heavy)">${esc(img.caption)}</text>` : ''}
  ${tips.map((tip, i) => `<text x="${mid}" y="${h - s(80) + i * s(36)}" text-anchor="middle" font-family="${f}" font-size="${s(26)}" fill="${c}" filter="url(#heavy)">💡 ${esc(tip)}</text>`).join('')}
  ${img.copyText ? `<text x="${mid}" y="${h - s(40)}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" fill="${c}" filter="url(#heavy)">${esc(img.copyText)}</text>` : ''}
  ${img.quote ? `<text x="${mid}" y="${h - s(8)}" text-anchor="middle" font-family="${f}" font-size="${s(20)}" font-style="italic" fill="${c}" filter="url(#heavy)">${esc(img.quote)}</text>` : ''}
</svg>`;
}

function cardComparison(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, lc: string, rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const left = img.left?.title || '别问为什么不';
  const right = img.right?.title || '要问为什么要';
  const cardW = s(440), cardH = s(70);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="cs"><feDropShadow dx="2" dy="3" stdDeviation="4" flood-opacity="0.35"/></filter></defs>
  <rect x="${mid - cardW / 2}" y="30" width="${cardW}" height="${cardH}" rx="${s(35)}" fill="rgba(0,0,0,0.6)" filter="url(#cs)"/>
  <text x="${mid}" y="${30 + cardH * 0.65}" text-anchor="middle" font-family="${f}" font-size="${s(38)}" font-weight="700" fill="${c}">${esc(img.title)}</text>
  <rect x="30" y="${h - s(170)}" width="${mid - 50}" height="${s(60)}" rx="16" fill="${lc}" fill-opacity="0.8" filter="url(#cs)"/>
  <text x="${(mid - 50) / 2 + 30}" y="${h - s(130)}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" font-weight="600" fill="${c}">✗ ${esc(left)}</text>
  <rect x="${mid + 20}" y="${h - s(170)}" width="${mid - 50}" height="${s(60)}" rx="16" fill="${rc}" fill-opacity="0.8" filter="url(#cs)"/>
  <text x="${mid + 20 + (mid - 50) / 2}" y="${h - s(130)}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" font-weight="600" fill="${c}">✓ ${esc(right)}</text>
  ${img.copyText ? `<rect x="60" y="${h - s(95)}" width="${w - 120}" height="${s(45)}" rx="${s(22)}" fill="rgba(0,0,0,0.55)" filter="url(#cs)"/>
  <text x="${mid}" y="${h - s(64)}" text-anchor="middle" font-family="${f}" font-size="${s(24)}" fill="${c}">${esc(img.copyText)}</text>` : ''}
  ${img.quote ? `<text x="${mid}" y="${h - s(20)}" text-anchor="middle" font-family="${f}" font-size="${s(20)}" font-style="italic" fill="${c}" opacity="0.7">${esc(img.quote)}</text>` : ''}
</svg>`;
}

function cardNormal(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, _lc: string, _rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const tips = img.tips || [];
  const cardW = s(440), cardH = s(70);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="cs"><feDropShadow dx="2" dy="3" stdDeviation="4" flood-opacity="0.35"/></filter></defs>
  <rect x="${mid - cardW / 2}" y="30" width="${cardW}" height="${cardH}" rx="${s(35)}" fill="rgba(0,0,0,0.6)" filter="url(#cs)"/>
  <text x="${mid}" y="${30 + cardH * 0.65}" text-anchor="middle" font-family="${f}" font-size="${s(38)}" font-weight="700" fill="${c}">${esc(img.title)}</text>
  ${img.caption ? `<rect x="60" y="${h - s(170)}" width="${w - 120}" height="${s(50)}" rx="${s(25)}" fill="rgba(0,0,0,0.55)" filter="url(#cs)"/>
  <text x="${mid}" y="${h - s(137)}" text-anchor="middle" font-family="${f}" font-size="${s(28)}" fill="${c}">${esc(img.caption)}</text>` : ''}
  ${tips.map((tip, i) => `<rect x="60" y="${h - s(110) + i * s(42)}" width="${w - 120}" height="${s(36)}" rx="${s(18)}" fill="rgba(255,213,79,0.8)" filter="url(#cs)"/>
  <text x="${mid}" y="${h - s(85) + i * s(42)}" text-anchor="middle" font-family="${f}" font-size="${s(22)}" fill="#3E2723">💡 ${esc(tip)}</text>`).join('')}
  ${img.copyText ? `<text x="${mid}" y="${h - s(30)}" text-anchor="middle" font-family="${f}" font-size="${s(24)}" fill="${c}" opacity="0.8">${esc(img.copyText)}</text>` : ''}
</svg>`;
}

function minimalComparison(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, lc: string, rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const left = img.left?.title || '别问为什么不';
  const right = img.right?.title || '要问为什么要';
  const stripH = s(60);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
  <rect x="0" y="${h - stripH}" width="${w}" height="${stripH}" fill="rgba(0,0,0,0.45)"/>
  <text x="40" y="${h - stripH / 2 + 8}" font-family="${f}" font-size="${s(26)}" fill="${lc}" filter="url(#ts)">✗ ${esc(left)}</text>
  <text x="${mid + 20}" y="${h - stripH / 2 + 8}" font-family="${f}" font-size="${s(26)}" fill="${rc}" filter="url(#ts)">✓ ${esc(right)}</text>
  <text x="${w - 40}" y="${h - stripH / 2 + 8}" text-anchor="end" font-family="${f}" font-size="${s(22)}" fill="${c}" opacity="0.6">${esc(img.title)}</text>
</svg>`;
}

function minimalNormal(img: ScriptImage, w: number, h: number, _t: Theme, f: string, c: string, sc: number, _lc: string, _rc: string): string {
  const s = (v: number) => Math.round(v * sc * BASE_SCALE);
  const mid = w / 2;
  const stripH = s(50);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
  <rect x="0" y="${h - stripH}" width="${w}" height="${stripH}" fill="rgba(0,0,0,0.4)"/>
  <text x="${mid}" y="${h - stripH / 2 + 7}" text-anchor="middle" font-family="${f}" font-size="${s(26)}" fill="${c}" filter="url(#ts)">${esc(img.title)}${img.copyText ? `  ·  ${esc(img.copyText)}` : ''}</text>
</svg>`;
}

const BUILDERS: Record<TextLayout, {
  comparison: Builder;
  normal: Builder;
}> = {
  bar: { comparison: barComparison, normal: barNormal },
  floating: { comparison: floatingComparison, normal: floatingNormal },
  card: { comparison: cardComparison, normal: cardNormal },
  minimal: { comparison: minimalComparison, normal: minimalNormal },
};

export async function compositeTextOnImage(
  baseImagePath: string,
  outputPath: string,
  imageScript: ScriptImage,
  style: ComicStyle,
  fontStyle: FontStyle = 'default',
  textLayout: TextLayout = 'bar',
  fontColor: FontColor = 'white',
  fontScale: number = 1.0,
  leftColor: FontColor = 'red',
  rightColor: FontColor = 'lime',
): Promise<void> {
  const theme = getTheme(style);
  const font = FONT_STYLES[fontStyle]?.fontFamily || FONT_STYLES.default.fontFamily;
  const color = FONT_COLORS[fontColor]?.hex || FONT_COLORS.white.hex;
  const sc = Math.max(0.3, Math.min(3.0, fontScale || 1.0));
  const lc = FONT_COLORS[leftColor]?.hex || '#EF5350';
  const rc = FONT_COLORS[rightColor]?.hex || '#AED581';
  const metadata = await sharp(baseImagePath).metadata();
  const w = metadata.width || 1920;
  const h = metadata.height || 1920;

  const builder = BUILDERS[textLayout] || BUILDERS.bar;
  const svg = imageScript.mode === 'comparison'
    ? builder.comparison(imageScript, w, h, theme, font, color, sc, lc, rc)
    : builder.normal(imageScript, w, h, theme, font, color, sc, lc, rc);

  await sharp(baseImagePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);
}

export async function exportComposite(
  imagePaths: string[],
  outputPath: string,
  layout: 'grid' | 'vertical' | 'horizontal' = 'grid',
  padding: number = 40,
): Promise<void> {
  if (imagePaths.length === 0) return;

  const metas = await Promise.all(imagePaths.map(p => sharp(p).metadata()));
  const imgW = metas[0].width || 1920;
  const imgH = metas[0].height || 1920;
  const count = imagePaths.length;

  let canvasW: number, canvasH: number;
  let positions: Array<{ x: number; y: number; w: number; h: number }>;

  if (layout === 'vertical') {
    canvasW = imgW + padding * 2;
    canvasH = count * imgH + (count + 1) * padding;
    positions = imagePaths.map((_, i) => ({ x: padding, y: padding + i * (imgH + padding), w: imgW, h: imgH }));
  } else if (layout === 'horizontal') {
    canvasW = count * imgW + (count + 1) * padding;
    canvasH = imgH + padding * 2;
    positions = imagePaths.map((_, i) => ({ x: padding + i * (imgW + padding), y: padding, w: imgW, h: imgH }));
  } else {
    const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    canvasW = cols * imgW + (cols + 1) * padding;
    canvasH = rows * imgH + (rows + 1) * padding;
    positions = imagePaths.map((_, i) => {
      const col = i % cols; const row = Math.floor(i / cols);
      return { x: padding + col * (imgW + padding), y: padding + row * (imgH + padding), w: imgW, h: imgH };
    });
  }

  const composites = await Promise.all(
    imagePaths.map(async (p, i) => ({
      input: await sharp(p).resize(positions[i].w, positions[i].h, { fit: 'cover' }).toBuffer(),
      top: positions[i].y, left: positions[i].x,
    })),
  );

  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(outputPath);
}
