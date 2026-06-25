import type { FastifyInstance } from 'fastify';
import { generateShare, listShares, getShare, exportShare } from '../services/share-generator.js';

export async function shareRoutes(app: FastifyInstance) {

  app.get('/api/shares', async () => {
    return listShares();
  });

  app.post<{ Params: { id: string } }>('/api/shares/:id/export', async (req, reply) => {
    const share = getShare(req.params.id);
    if (!share) return reply.status(404).send({ error: 'Share not found' });
    try {
      const exportDir = exportShare(share);
      return { exportDir };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.get<{ Params: { id: string } }>('/api/shares/:id', async (req, reply) => {
    const share = getShare(req.params.id);
    if (!share) return reply.status(404).send({ error: 'Share not found' });
    return share;
  });

  app.get<{
    Querystring: { url: string; enableComics?: string; comicStyle?: string; articleStyle?: string };
  }>('/api/shares/generate', {
    schema: {
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
          enableComics: { type: 'string' },
          comicStyle: { type: 'string' },
          articleStyle: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { url, enableComics, comicStyle, articleStyle } = req.query;
    const comics = enableComics === 'true';

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
      const share = await generateShare(url, comics, comicStyle || 'cute', articleStyle || 'popular', (phase, detail, progress, total) => {
        send('progress', { phase, detail, progress, total });
      });
      send('complete', { shareId: share.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败';
      send('error', { message: msg });
    } finally {
      reply.raw.end();
    }
  });
}
