import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { COMIC_STYLES, FONT_STYLES, FONT_COLORS, TEXT_LAYOUTS, type ComicStyle, type FontStyle, type FontColor, type TextLayout, type ImageConfig, type StickerRequest } from '../types.js';
import {
  generateComic,
  listComics,
  getComic,
  getComicImagePath,
  exportComicLayout,
  recomposeComic,
} from '../services/sticker-generator.js';

export async function stickerRoutes(app: FastifyInstance) {
  app.get('/api/stickers/styles', async () => {
    return COMIC_STYLES;
  });

  app.get('/api/stickers/fonts', async () => {
    return FONT_STYLES;
  });

  app.get('/api/stickers', async () => {
    return listComics();
  });

  app.get<{ Params: { id: string } }>('/api/stickers/:id', async (req, reply) => {
    const comic = getComic(req.params.id);
    if (!comic) return reply.status(404).send({ error: '漫画未找到' });
    return comic;
  });

  app.get<{ Params: { id: string; filename: string } }>(
    '/api/stickers/:id/images/:filename',
    async (req, reply) => {
      const filePath = getComicImagePath(req.params.id, req.params.filename);
      if (!filePath) return reply.status(404).send({ error: '图片未找到' });
      reply.header('Cache-Control', 'no-cache');
      return reply.type('image/png').send(createReadStream(filePath));
    },
  );

  app.post<{ Params: { id: string }; Body: { fontStyle?: FontStyle; fontColor?: FontColor; textLayout?: TextLayout; style?: ComicStyle } }>(
    '/api/stickers/:id/recompose',
    async (req, reply) => {
      const { fontStyle = 'default', fontColor = 'white', textLayout = 'bar', style } = (req.body || {}) as { fontStyle?: FontStyle; fontColor?: FontColor; textLayout?: TextLayout; style?: ComicStyle };
      const comic = await recomposeComic(req.params.id, fontStyle, textLayout, fontColor, style);
      if (!comic) return reply.status(404).send({ error: '漫画未找到' });
      return comic;
    },
  );

  app.get<{ Params: { id: string }; Querystring: { layout?: string } }>(
    '/api/stickers/:id/export',
    async (req, reply) => {
      const layout = (req.query.layout || 'grid') as 'grid' | 'vertical' | 'horizontal';
      const exportFile = await exportComicLayout(req.params.id, layout);
      if (!exportFile) return reply.status(404).send({ error: '导出失败' });
      const filePath = getComicImagePath(req.params.id, exportFile);
      if (!filePath) return reply.status(404).send({ error: '导出文件未找到' });
      return reply.type('image/png').send(createReadStream(filePath));
    },
  );

  app.get<{
    Querystring: {
      topic: string;
      style?: ComicStyle;
      fontStyle?: FontStyle;
      fontColor?: FontColor;
      textLayout?: TextLayout;
      imageCount?: string;
      configs?: string;
    };
  }>('/api/stickers/generate', async (req, reply) => {
    const { topic, style = 'warm', fontStyle = 'default', fontColor = 'white', textLayout = 'bar', imageCount: countStr = '3', configs: configsStr } = req.query || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return reply.status(400).send({ error: '请提供漫画主题' });
    }

    const imageCount = Math.max(1, Math.min(6, parseInt(countStr, 10) || 3));

    let imageConfigs: ImageConfig[];
    try {
      imageConfigs = configsStr ? JSON.parse(configsStr) : [];
    } catch {
      imageConfigs = [];
    }

    while (imageConfigs.length < imageCount) {
      imageConfigs.push({ mode: 'comparison' });
    }
    imageConfigs = imageConfigs.slice(0, imageCount);

    const request: StickerRequest = {
      topic: topic.trim(),
      style: style as ComicStyle,
      fontStyle: fontStyle as FontStyle,
      fontColor: fontColor as FontColor,
      textLayout: textLayout as TextLayout,
      imageCount,
      imageConfigs,
    };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    reply.raw.write('retry: 86400000\n\n');

    const send = (event: string, data: unknown) => {
      try { reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    try {
      const comic = await generateComic(request, (phase, detail, progress, total) => {
        send('progress', { phase, detail, progress, total });
      });
      send('complete', { comicId: comic.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Sticker generation failed:', msg);
      send('error', { message: msg });
    } finally {
      reply.raw.end();
    }
  });
}
