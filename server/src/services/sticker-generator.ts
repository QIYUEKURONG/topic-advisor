import { fetch } from 'undici';
import { nanoid } from 'nanoid';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  ComicScript, ScriptImage, ComicStyle, FontStyle, FontColor, TextLayout, GeneratedComic,
  AIProviderConfig, ImageProviderConfig, Settings,
  StickerRequest, ImageConfig,
} from '../types.js';
import { COMIC_STYLES } from '../types.js';
import { getSettings } from '../config/settings.js';
import { compositeTextOnImage, exportComposite } from './image-composer.js';

function getDataDir(): string {
  if (process.env.TOPIC_ADVISOR_DATA) return process.env.TOPIC_ADVISOR_DATA;
  if (process.env.NODE_ENV === 'production') {
    return join(homedir(), '.topic-advisor');
  }
  return join(process.cwd(), 'data');
}

function getStickersDir(): string {
  const dir = join(getDataDir(), 'stickers');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function callTextAI(
  system: string,
  user: string,
  config: AIProviderConfig,
): Promise<string> {
  if (config.provider === 'claude') {
    const resp = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${await resp.text()}`);
    const data = (await resp.json()) as { content: Array<{ text: string }> };
    return data.content?.[0]?.text ?? '';
  }

  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) throw new Error(`Text AI ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

export async function generateComicScript(
  topic: string,
  style: ComicStyle,
  imageConfigs: ImageConfig[],
  config: AIProviderConfig,
): Promise<ComicScript> {
  const styleInfo = COMIC_STYLES[style];
  const count = imageConfigs.length;

  const configDesc = imageConfigs.map((c, i) => {
    if (c.mode === 'comparison') {
      return `第${i + 1}张: 对比模式 — 左半部分为"错误做法/反面"，右半部分为"正确做法/正面"${c.hint ? `，提示: ${c.hint}` : ''}`;
    }
    return `第${i + 1}张: 普通模式 — 单张完整插画配文字说明${c.hint ? `，提示: ${c.hint}` : ''}`;
  }).join('\n');

  const comparisonExample = `{
      "mode": "comparison",
      "title": "学习态度",
      "left": { "title": "别问为什么不", "scene": "一个人瘫在沙发上玩手机，周围散落着书本", "emotion": "懒散" },
      "right": { "title": "要问为什么要", "scene": "同一个人坐在书桌前认真看书，桌上放着笔记本", "emotion": "专注" },
      "copyText": "学习不是为了别人，是为了遇见更好的自己",
      "quote": "今天不学习，明天变垃圾"
    }`;

  const normalExample = `{
      "mode": "normal",
      "title": "变得快乐的3种方式",
      "scene": "一个人在阳光下的花园里微笑奔跑",
      "caption": "快乐其实很简单",
      "tips": ["多出去走走", "学会感恩", "做喜欢的事"],
      "copyText": "快乐不在远方，就在你转身的那一刻",
      "quote": "笑一笑，十年少"
    }`;

  const result = await callTextAI(
    `你是一位微信漫画贴图创作专家。根据主题和用户配置，为每张图片生成脚本。
画风: ${styleInfo.label} - ${styleInfo.description}`,

    `请为主题「${topic}」创作 ${count} 张漫画贴图的脚本。

每张图的配置：
${configDesc}

严格输出以下 JSON，不要输出其他内容：
{
  "overallTitle": "整组贴图的总标题",
  "characterDescription": "统一的人物外貌描述（如：一位约25岁的年轻女性，扎马尾，穿白色T恤和牛仔裤）",
  "postCaption": "发图文案（适合在社交媒体发布这组图片时配的文字，带emoji和话题标签，100-200字）",
  "images": [
    对比模式示例: ${comparisonExample},
    普通模式示例: ${normalExample}
  ]
}

注意：
- images 数组必须有 ${count} 个元素
- 对比模式的 left/right 的 scene 要形成鲜明对比
- 普通模式的 tips 最多3条，每条不超过8个字
- 所有 title 要简短有力（2-8个字）
- scene 描述要具体生动，方便AI生图
- 每张图必须有 copyText 字段：解释这张图的含义和结论（15-25个字，让观众一看就懂）
- 每张图必须有 quote 字段：一句幽默/深刻/鸡汤的短句（不超过15个字）
- postCaption 必须填写：这是发布这组图片时配的文案，要吸引人，带emoji，可以包含#话题标签#，语气亲切活泼
${style === 'narrative' ? `
【叙事风格特别要求】
- 这组图要像一个完整的故事/社会观察报告，每张图是故事的一个章节
- scene 要描述具体的社会场景、人物状态、环境细节（如：拥挤的地铁车厢里，西装革履的中年人低头看手机，旁边是背着书包的学生）
- 多描写不同阶层、不同群体在同一事件下的不同反应
- title 要有新闻感和洞察力（如：当焦虑蔓延、沉默的大多数、不同的选择）
- copyText 和 quote 要有社会评论的深度，像纪录片旁白
- 对比模式特别适合展示阶层差异、城乡差异、代际差异等` : ''}`,
    config,
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 未返回有效 JSON 脚本');

  const parsed = JSON.parse(jsonMatch[0]);

  const images: ScriptImage[] = (parsed.images || []).map((img: any, i: number) => {
    const expectedMode = imageConfigs[i]?.mode || 'normal';
    const quote = img.quote || '';
    const copyText = img.copyText || '';
    if (expectedMode === 'comparison') {
      return {
        mode: 'comparison' as const,
        title: img.title || '',
        left: {
          title: img.left?.title || '别问为什么不',
          scene: img.left?.scene || '',
          emotion: img.left?.emotion || '',
        },
        right: {
          title: img.right?.title || '要问为什么要',
          scene: img.right?.scene || '',
          emotion: img.right?.emotion || '',
        },
        copyText,
        quote,
      };
    }
    return {
      mode: 'normal' as const,
      title: img.title || '',
      scene: img.scene || '',
      caption: img.caption || '',
      tips: Array.isArray(img.tips) ? img.tips.slice(0, 3) : [],
      copyText,
      quote,
    };
  });

  return {
    topic,
    overallTitle: parsed.overallTitle || topic,
    characterDescription: parsed.characterDescription || '',
    postCaption: parsed.postCaption || '',
    images,
  };
}

async function generateImageSeedream(
  prompt: string,
  config: ImageProviderConfig,
  hideWatermark = true,
): Promise<string> {
  const body: Record<string, any> = {
    model: config.model || 'doubao-seedream-4-5-251128',
    prompt,
    size: '1920x1920',
    response_format: 'url',
  };
  if (hideWatermark) {
    body.logo_info = { add_logo: false };
  }
  const resp = await fetch(`${config.baseUrl}/api/v3/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) throw new Error(`Seedream ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { data?: Array<{ url?: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('Seedream 未返回图片 URL');
  return url;
}

async function generateImageDashScope(
  prompt: string,
  config: ImageProviderConfig,
): Promise<string> {
  const submitResp = await fetch(
    `${config.baseUrl}/api/v1/services/aigc/text2image/image-synthesis`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: config.model || 'wanx-v1',
        input: { prompt },
        parameters: { size: '1024*1024', n: 1 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!submitResp.ok) throw new Error(`DashScope submit ${submitResp.status}: ${await submitResp.text()}`);
  const submitData = (await submitResp.json()) as { output?: { task_id: string } };
  const taskId = submitData.output?.task_id;
  if (!taskId) throw new Error('DashScope 未返回 task_id');

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollResp = await fetch(
      `${config.baseUrl}/api/v1/tasks/${taskId}`,
      { headers: { 'Authorization': `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(15_000) },
    );
    if (!pollResp.ok) continue;
    const pollData = (await pollResp.json()) as {
      output?: { task_status: string; results?: Array<{ url?: string }> };
    };
    const status = pollData.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = pollData.output?.results?.[0]?.url;
      if (url) return url;
      throw new Error('DashScope 任务成功但无图片 URL');
    }
    if (status === 'FAILED') throw new Error('DashScope 图片生成失败');
  }
  throw new Error('DashScope 图片生成超时');
}

async function generateImageCogView(
  prompt: string,
  config: ImageProviderConfig,
): Promise<string> {
  const resp = await fetch(`${config.baseUrl}/api/paas/v4/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'cogView-4-250304',
      prompt,
      size: '1024x1024',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) throw new Error(`CogView ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { data?: Array<{ url?: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('CogView 未返回图片 URL');
  return url;
}

async function generateImage(
  prompt: string,
  config: ImageProviderConfig,
  hideWatermark = true,
): Promise<string> {
  if (config.provider === 'seedream') return generateImageSeedream(prompt, config, hideWatermark);
  if (config.provider === 'dashscope') return generateImageDashScope(prompt, config);
  if (config.provider === 'cogview') return generateImageCogView(prompt, config);
  throw new Error(`不支持的图片提供商: ${config.provider}`);
}

async function downloadImage(url: string, savePath: string): Promise<void> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`下载图片失败: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(savePath, buffer);
}

async function optimizeImagePrompts(
  script: ComicScript,
  style: ComicStyle,
  config: AIProviderConfig,
): Promise<string[]> {
  const styleInfo = COMIC_STYLES[style];

  const imageDescs = script.images.map((img, i) => {
    if (img.mode === 'comparison') {
      return `第${i + 1}张(对比模式): 左边="${img.left?.scene}" (${img.left?.emotion}), 右边="${img.right?.scene}" (${img.right?.emotion})`;
    }
    return `第${i + 1}张(普通模式): 场景="${img.scene}"`;
  }).join('\n');

  const result = await callTextAI(
    `你是一位专业的AI绘图提示词工程师。将漫画脚本转换为高质量图片生成提示词。

规则：
1. 纯英文提示词
2. 包含画风: ${styleInfo.promptHint}
3. 包含人物外貌细节确保一致性
4. 不要包含任何文字、对话气泡、标题
5. 对比模式: 画面分左右两半，左边展示负面场景，右边展示正面场景，同一人物
6. 普通模式: 完整单张插画，聚焦主题
7. 每个提示词 80-120 个英文单词`,

    `人物设定: ${script.characterDescription}
画风: ${styleInfo.label}

图片描述:
${imageDescs}

输出JSON数组，每个元素是一个英文提示词字符串:
["prompt1", "prompt2", ...]`,
    config,
  );

  const arrayMatch = result.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const prompts = JSON.parse(arrayMatch[0]) as string[];
      if (Array.isArray(prompts) && prompts.length >= script.images.length) {
        return prompts.slice(0, script.images.length);
      }
    } catch { /* fallback below */ }
  }

  return script.images.map((img) => {
    const scene = img.mode === 'comparison'
      ? `split scene, left side: ${img.left?.scene}, right side: ${img.right?.scene}`
      : img.scene || '';
    return `${styleInfo.promptHint}, ${scene}, character: ${script.characterDescription}, no text, no speech bubbles, high quality illustration`;
  });
}

export type ProgressCallback = (phase: string, detail: string, progress: number, total: number) => void;

export async function generateComic(
  request: StickerRequest,
  onProgress?: ProgressCallback,
): Promise<GeneratedComic> {
  const settings = getSettings();
  const aiConfig = settings.aiProvider;
  const imageConfig = settings.imageProvider;

  if (!aiConfig.apiKey) throw new Error('请先在设置中配置文本 AI 的 API Key');
  if (!imageConfig.apiKey) throw new Error('请先在设置中配置图片生成 API Key');

  const { topic, style, fontStyle = 'default', fontColor = 'white', fontScale = 1.0, leftColor = 'red', rightColor = 'lime', textLayout = 'bar', imageConfigs } = request;
  const count = imageConfigs.length;

  const comicId = nanoid(12);
  const comicDir = join(getStickersDir(), comicId);
  mkdirSync(comicDir, { recursive: true });

  const totalSteps = 2 + count * 2 + 1;
  let step = 0;

  onProgress?.('script', '生成脚本...', step, totalSteps);
  const script = await generateComicScript(topic, style, imageConfigs, aiConfig);
  writeFileSync(join(comicDir, 'script.json'), JSON.stringify(script, null, 2));
  step++;

  onProgress?.('prompt', 'AI 优化绘图提示词...', step, totalSteps);
  const prompts = await optimizeImagePrompts(script, style, aiConfig);
  writeFileSync(join(comicDir, 'prompts.json'), JSON.stringify(prompts, null, 2));
  step++;

  const rawImages: string[] = [];
  const finalImages: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      onProgress?.('image', `生成第 ${i + 1}/${count} 张画面...`, step, totalSteps);
      const imageUrl = await generateImage(prompts[i], imageConfig, settings.hideAiWatermark !== false);
      const rawPath = join(comicDir, `raw-${i + 1}.png`);
      await downloadImage(imageUrl, rawPath);
      rawImages.push(`raw-${i + 1}.png`);
      step++;

      onProgress?.('compose', `合成第 ${i + 1}/${count} 张文字...`, step, totalSteps);
      const finalPath = join(comicDir, `final-${i + 1}.png`);
      await compositeTextOnImage(rawPath, finalPath, script.images[i], style, fontStyle, textLayout, fontColor, fontScale, leftColor, rightColor);
      finalImages.push(`final-${i + 1}.png`);
      step++;
    } catch (err) {
      console.error(`Image ${i + 1} failed:`, err instanceof Error ? err.message : err);
      step += 2;
    }
  }

  if (finalImages.length === 0) {
    try { const { rmSync } = await import('node:fs'); rmSync(comicDir, { recursive: true, force: true }); } catch {}
    throw new Error('所有图片生成都失败了');
  }

  onProgress?.('done', '完成！', totalSteps, totalSteps);

  const comic: GeneratedComic = {
    id: comicId,
    topic,
    style,
    script,
    rawImages,
    finalImages,
    status: 'done',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(comicDir, 'comic.json'), JSON.stringify(comic, null, 2));
  return comic;
}

export function listComics(): GeneratedComic[] {
  const dir = getStickersDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const metaPath = join(dir, e.name, 'comic.json');
      if (!existsSync(metaPath)) return null;
      try { return JSON.parse(readFileSync(metaPath, 'utf-8')) as GeneratedComic; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as GeneratedComic[];
}

export function getComic(id: string): GeneratedComic | null {
  const metaPath = join(getStickersDir(), id, 'comic.json');
  if (!existsSync(metaPath)) return null;
  try { return JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { return null; }
}

export function getComicImagePath(comicId: string, filename: string): string | null {
  const p = join(getStickersDir(), comicId, filename);
  return existsSync(p) ? p : null;
}

export async function recomposeComic(
  comicId: string,
  fontStyle: FontStyle,
  textLayout: TextLayout = 'bar',
  fontColor: FontColor = 'white',
  fontScale: number = 1.0,
  leftColor: FontColor = 'red',
  rightColor: FontColor = 'lime',
  style?: ComicStyle,
): Promise<GeneratedComic | null> {
  const comic = getComic(comicId);
  if (!comic) return null;

  const comicDir = join(getStickersDir(), comicId);
  const newFinals: string[] = [];

  for (let i = 0; i < comic.rawImages.length; i++) {
    const rawPath = join(comicDir, comic.rawImages[i]);
    if (!existsSync(rawPath)) continue;

    const finalFile = `final-${i + 1}.png`;
    const finalPath = join(comicDir, finalFile);
    const s = style || comic.style;
    await compositeTextOnImage(rawPath, finalPath, comic.script.images[i], s, fontStyle, textLayout, fontColor, fontScale, leftColor, rightColor);
    newFinals.push(finalFile);
  }

  comic.finalImages = newFinals;
  comic.version = (comic.version || 0) + 1;
  writeFileSync(join(comicDir, 'comic.json'), JSON.stringify(comic, null, 2));
  return comic;
}

export async function updateComicScript(
  comicId: string,
  imageIndex: number,
  updates: Partial<ScriptImage>,
  fontStyle: FontStyle,
  textLayout: TextLayout = 'bar',
  fontColor: FontColor = 'white',
  fontScale: number = 1.0,
  leftColor: FontColor = 'red',
  rightColor: FontColor = 'lime',
): Promise<GeneratedComic | null> {
  const comic = getComic(comicId);
  if (!comic || imageIndex < 0 || imageIndex >= comic.script.images.length) return null;

  const img = comic.script.images[imageIndex];
  if (updates.title !== undefined) img.title = updates.title;
  if (updates.copyText !== undefined) img.copyText = updates.copyText;
  if (updates.caption !== undefined) img.caption = updates.caption;
  if (updates.quote !== undefined) img.quote = updates.quote;
  if (updates.left) img.left = { ...img.left!, ...updates.left };
  if (updates.right) img.right = { ...img.right!, ...updates.right };
  if (updates.tips) img.tips = updates.tips;

  const comicDir = join(getStickersDir(), comicId);
  writeFileSync(join(comicDir, 'script.json'), JSON.stringify(comic.script, null, 2));

  const rawPath = join(comicDir, comic.rawImages[imageIndex]);
  if (existsSync(rawPath)) {
    const finalFile = `final-${imageIndex + 1}.png`;
    const finalPath = join(comicDir, finalFile);
    await compositeTextOnImage(rawPath, finalPath, img, comic.style, fontStyle, textLayout, fontColor, fontScale, leftColor, rightColor);
  }

  comic.version = (comic.version || 0) + 1;
  writeFileSync(join(comicDir, 'comic.json'), JSON.stringify(comic, null, 2));
  return comic;
}

export async function exportComicLayout(
  comicId: string,
  layout: 'grid' | 'vertical' | 'horizontal' = 'grid',
): Promise<string | null> {
  const comic = getComic(comicId);
  if (!comic) return null;

  const comicDir = join(getStickersDir(), comicId);
  const imagePaths = comic.finalImages.map(f => join(comicDir, f)).filter(p => existsSync(p));
  if (imagePaths.length === 0) return null;

  const exportFile = `export-${layout}.png`;
  const exportPath = join(comicDir, exportFile);
  await exportComposite(imagePaths, exportPath, layout);
  return exportFile;
}
