import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { tasksRoutes } from './routes/tasks.js';
import { settingsRoutes } from './routes/settings.js';
import { toutiaoRoutes } from './routes/toutiao.js';
import { imageProxyRoutes } from './routes/image-proxy.js';
import { stickerRoutes } from './routes/stickers.js';
import { shareRoutes } from './routes/shares.js';
import { trendRoutes } from './routes/trends.js';
import { cardRoutes } from './routes/cards.js';

const PORT = 3721;

async function main() {
  const app = Fastify({
    logger: { level: 'info' },
    connectionTimeout: 180_000,
    requestTimeout: 180_000,
  });

  await app.register(cors, { origin: true });

  await app.register(tasksRoutes);
  await app.register(settingsRoutes);
  await app.register(toutiaoRoutes);
  await app.register(imageProxyRoutes);
  await app.register(stickerRoutes);
  await app.register(shareRoutes);
  await app.register(trendRoutes);
  await app.register(cardRoutes);

  const resourcesRoot = process.env.TOPIC_ADVISOR_RESOURCES || resolve(process.cwd(), '..');
  const distPath = join(resourcesRoot, 'web', 'dist');
  if (existsSync(distPath)) {
    await app.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
    });

    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html', distPath);
    });
  }

  await app.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`\n  🚀 Topic Advisor running at http://127.0.0.1:${PORT}\n`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
