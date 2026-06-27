import type { FastifyPluginAsync } from 'fastify';
import {
  runTrendCrawl,
  analyzeViralPotential,
  getLatestSnapshot,
  listSnapshots,
  getSnapshot,
  getAvailablePlatforms,
  getAvailableDirections,
} from '../services/trend-analyzer.js';

export const trendRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/trends/platforms', async () => {
    return getAvailablePlatforms();
  });

  app.get('/api/trends/directions', async () => {
    return getAvailableDirections();
  });

  app.get('/api/trends/snapshots', async (req) => {
    const { limit } = req.query as { limit?: string };
    return listSnapshots(limit ? parseInt(limit) : 30);
  });

  app.get<{ Params: { id: string } }>('/api/trends/snapshots/:id', async (req, reply) => {
    const snap = getSnapshot(req.params.id);
    if (!snap) return reply.code(404).send({ error: 'Snapshot not found' });
    return snap;
  });

  app.get('/api/trends/latest', async () => {
    const snap = getLatestSnapshot();
    return snap || { items: [], hotTopics: [], date: null };
  });

  app.post('/api/trends/crawl', async (req) => {
    const { sourceIds, direction } = req.body as {
      sourceIds?: string[];
      direction?: string;
    };
    const snapshot = await runTrendCrawl(sourceIds, direction);
    return snapshot;
  });

  app.get('/api/trends/crawl', async (req, reply) => {
    const { sources, direction } = req.query as { sources?: string; direction?: string };
    const sourceIds = sources ? sources.split(',') : undefined;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('progress', { phase: 'crawling', message: '正在抓取各平台数据...' });

    try {
      const snapshot = await runTrendCrawl(sourceIds, direction);
      send('progress', { phase: 'analyzing', message: `已抓取 ${snapshot.items.length} 篇，正在分析热点...` });
      send('complete', { snapshotId: snapshot.id, itemCount: snapshot.items.length, topicCount: snapshot.hotTopics.length });
    } catch (err: any) {
      send('error', { message: err.message || '抓取失败' });
    }

    reply.raw.end();
  });

  app.post('/api/trends/analyze', async (req) => {
    const { title, content } = req.body as { title: string; content: string };
    if (!title && !content) {
      return { error: '请提供标题或内容' };
    }
    return analyzeViralPotential(title || '', content || '');
  });
};
