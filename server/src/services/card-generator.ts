import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { fetch } from 'undici';
import { getSettings } from '../config/settings.js';
import { renderCardHTML, CARD_LAYOUTS } from './card-templates.js';
import type { CardData, CardItem, CardStyle, CardLayout } from './card-templates.js';

function getCardsDir(): string {
  const dataRoot = process.env.TOPIC_ADVISOR_DATA || resolve(process.cwd(), 'data');
  const dir = join(dataRoot, 'cards');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface GeneratedCard {
  id: string;
  topic: string;
  style: CardStyle;
  layout: CardLayout;
  data: CardData;
  imagePath: string;
  status: 'generating' | 'done' | 'failed';
  error?: string;
  createdAt: string;
}

async function aiGenerateCardContent(
  topic: string,
  itemCount: number,
): Promise<{ mainTitle: string; subtitle: string; items: CardItem[] }> {
  const settings = getSettings();
  const { apiKey, baseUrl, model } = settings.aiProvider;

  if (!apiKey) throw new Error('请先在设置中配置 AI API Key');

  const systemPrompt = `你是一个知识卡片内容生成器。用户会给你一个主题，你需要生成结构化的知识卡片内容。

要求：
1. mainTitle: 大标题，4-8个字，简洁有力
2. subtitle: 副标题，10-20字的解释说明
3. items: 恰好 ${itemCount} 个条目，每个条目包含:
   - title: 条目标题，2-6个字
   - desc: 一句话描述，10-25字
   - icon: 一个相关的 emoji

语气要求：
- 干货为主，避免废话
- 像笔记一样精炼
- 实操性强

返回纯 JSON，不要 markdown 代码块。`;

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `主题: ${topic}` },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) throw new Error(`AI API ${resp.status}: ${await resp.text()}`);

  const data = (await resp.json()) as any;
  const text = data.choices?.[0]?.message?.content || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 未返回有效 JSON');

  const parsed = JSON.parse(jsonMatch[0]);

  const items: CardItem[] = (parsed.items || []).slice(0, itemCount).map((item: any) => ({
    title: String(item.title || ''),
    desc: String(item.desc || item.description || ''),
    icon: String(item.icon || item.emoji || '📌'),
  }));

  while (items.length < itemCount) {
    items.push({ title: `条目${items.length + 1}`, desc: '待补充', icon: '📌' });
  }

  return {
    mainTitle: String(parsed.mainTitle || parsed.title || topic),
    subtitle: String(parsed.subtitle || ''),
    items,
  };
}

async function renderToPNG(html: string, outputPath: string): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 800 });
    await page.setContent(html, { waitUntil: 'load' });

    const bodyHandle = await page.$('body');
    if (!bodyHandle) throw new Error('无法获取页面 body');

    const box = await bodyHandle.boundingBox();
    if (!box) throw new Error('无法获取页面尺寸');

    await page.setViewport({
      width: Math.ceil(box.width),
      height: Math.ceil(box.height),
    });

    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
    });
  } finally {
    await browser.close();
  }
}

export type CardProgressCallback = (phase: string, message: string) => void;

export async function generateCard(
  topic: string,
  style: CardStyle,
  layout: CardLayout,
  onProgress?: CardProgressCallback,
): Promise<GeneratedCard> {
  const cardId = generateId();
  const cardDir = join(getCardsDir(), cardId);
  mkdirSync(cardDir, { recursive: true });

  const layoutInfo = CARD_LAYOUTS.find((l) => l.id === layout);
  const itemCount = layoutInfo?.itemCount || 6;

  onProgress?.('content', '正在用 AI 生成内容...');

  const content = await aiGenerateCardContent(topic, itemCount);

  const cardData: CardData = {
    mainTitle: content.mainTitle,
    subtitle: content.subtitle,
    items: content.items,
    style,
    footer: '选题参谋 · 知识卡片',
  };

  writeFileSync(join(cardDir, 'data.json'), JSON.stringify(cardData, null, 2));

  onProgress?.('render', '正在渲染图片...');

  const html = renderCardHTML(cardData, layout);
  writeFileSync(join(cardDir, 'card.html'), html);

  const imagePath = join(cardDir, 'card.png');
  await renderToPNG(html, imagePath);

  onProgress?.('done', '完成！');

  const card: GeneratedCard = {
    id: cardId,
    topic,
    style,
    layout,
    data: cardData,
    imagePath: `card.png`,
    status: 'done',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(cardDir, 'card-meta.json'), JSON.stringify(card, null, 2));
  return card;
}

export function listCards(): GeneratedCard[] {
  const dir = getCardsDir();
  const folders = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());

  return folders
    .map((f) => {
      try {
        const metaPath = join(dir, f.name, 'card-meta.json');
        if (!existsSync(metaPath)) return null;
        return JSON.parse(readFileSync(metaPath, 'utf-8')) as GeneratedCard;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()) as GeneratedCard[];
}

export function getCard(id: string): GeneratedCard | null {
  const metaPath = join(getCardsDir(), id, 'card-meta.json');
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getCardImagePath(id: string): string | null {
  const imgPath = join(getCardsDir(), id, 'card.png');
  return existsSync(imgPath) ? imgPath : null;
}
