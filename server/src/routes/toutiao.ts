import type { FastifyInstance } from 'fastify';
import { toutiaoService } from '../services/toutiao.js';
import { loadTask } from '../services/storage.js';

export async function toutiaoRoutes(app: FastifyInstance) {
  app.get('/api/toutiao/status', async (_req, reply) => {
    const status = await toutiaoService.checkStatus();
    return reply.send(status);
  });

  app.post('/api/toutiao/login', async (_req, reply) => {
    try {
      const result = await toutiaoService.login();
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post('/api/toutiao/login/wait', async (_req, reply) => {
    const status = await toutiaoService.waitForLogin();
    return reply.send(status);
  });

  app.post('/api/toutiao/logout', async (_req, reply) => {
    toutiaoService.clearCookies();
    return reply.send({ loggedIn: false });
  });

  app.post<{
    Params: { id: string };
    Body: { articleIds: string[] };
  }>('/api/toutiao/publish/:id', async (req, reply) => {
    const task = loadTask(req.params.id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });

    const { articleIds } = req.body || {};
    if (!articleIds?.length) {
      return reply.status(400).send({ error: 'articleIds required' });
    }

    const articles = task.candidates.filter((a) => articleIds.includes(a.id));
    if (articles.length === 0) {
      return reply.status(400).send({ error: 'No matching articles found' });
    }

    const results = await toutiaoService.publishMultipleDrafts(articles);

    const successCount = results.filter((r) => r.success).length;
    return reply.send({
      total: articles.length,
      success: successCount,
      failed: articles.length - successCount,
      results: results.map((r, i) => ({
        articleId: articles[i].id,
        title: articles[i].title,
        ...r,
      })),
    });
  });
}
