import { fetch } from 'undici';
import type { FastifyInstance } from 'fastify';

export async function imageProxyRoutes(app: FastifyInstance) {
  app.get('/api/image-proxy', async (req, reply) => {
    const { url } = req.query as { url?: string };
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return reply.status(400).send({ error: 'Invalid URL' });
    }

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': new URL(url).origin + '/',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok || !resp.body) {
        return reply.status(502).send({ error: `Upstream ${resp.status}` });
      }

      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await resp.arrayBuffer());

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(buffer);
    } catch (err) {
      return reply.status(502).send({ error: String(err) });
    }
  });
}
