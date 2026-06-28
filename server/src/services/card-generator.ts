import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { fetch } from 'undici';
import { getSettings } from '../config/settings.js';
import { renderCardHTML, CARD_LAYOUTS, CARD_STYLES } from './card-templates.js';
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

  const systemPrompt = `你是一个小红书风格知识卡片内容生成器。用户会给你一个主题，你需要生成结构化的知识卡片内容。

参考风格：类似小红书上"36个富人思维"、"时间底盘"这类知识图卡。

严格要求：
1. mainTitle: 大标题，3-6个字，像口号一样有力（例如："富人思维"、"时间底盘"、"成长清单"）
2. subtitle: 副标题，8-15字（例如："不是天生，而是刻意练习的结果"）
3. items: 恰好 ${itemCount} 个条目，每个条目包含:
   - title: 关键词标签，2-4个字（例如："时间"、"精力"、"学习"、"目标"）
   - keyword: 核心方法/工具，3-6个字（例如："日程本"、"高价值时段"、"一本书笔记"）
   - desc: 一句话行动指南，8-18字（例如："把时间先排出来"、"聚焦精力，做最重要的事"）
   - icon: 一个贴切的 emoji（例如：📅、⏰、📖、🎯）

内容要求：
- 每一条必须是可操作的具体方法，不要空洞的大道理
- title 和 keyword 不要重复
- 条目之间有逻辑递进或分类关系
- 像学霸的笔记一样精炼实用

返回纯 JSON，不要 markdown 代码块，不要任何额外文字。`;

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
    keyword: String(item.keyword || item.subtitle || item.key || ''),
    desc: String(item.desc || item.description || ''),
    icon: String(item.icon || item.emoji || '📌'),
  }));

  while (items.length < itemCount) {
    items.push({ title: `条目${items.length + 1}`, keyword: '待补充', desc: '待补充', icon: '📌' });
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
  customTheme?: import('./card-templates.js').CardCustomTheme,
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
    customTheme,
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
