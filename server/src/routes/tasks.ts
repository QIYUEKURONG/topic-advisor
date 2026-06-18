import type { FastifyInstance } from 'fastify';
import { taskRunner } from '../services/task-runner.js';
import { loadTask, listTasks, exportSelected, saveTask, clearHistory } from '../services/storage.js';
import { getSettings } from '../config/settings.js';
import { rewriteArticle } from '../services/rewriter.js';
import { PLATFORM_PROMPTS, type RewritePlatform } from '../types.js';

export async function tasksRoutes(app: FastifyInstance) {
  app.post<{ Body: { count: number; topicKeywords?: string[]; extraSources?: string[] } }>('/api/tasks', async (req, reply) => {
    const { count, topicKeywords, extraSources } = req.body || {};

    if (!count || typeof count !== 'number' || count < 1 || count > 200) {
      return reply.status(400).send({ error: 'count must be 1-200' });
    }

    if (taskRunner.running) {
      return reply.status(409).send({ error: 'A task is already running' });
    }

    try {
      const task = await taskRunner.start(count, topicKeywords, extraSources);
      return reply.status(201).send({ taskId: task.id, status: task.status });
    } catch (err) {
      return reply.status(400).send({ error: String(err) });
    }
  });

  app.delete('/api/tasks/history', async (_req, reply) => {
    const deleted = clearHistory();
    return reply.send({ deleted, message: `Cleared ${deleted} task records` });
  });

  app.get('/api/tasks', async (_req, reply) => {
    const tasks = listTasks().map(({ candidates, logs, ...rest }) => ({
      ...rest,
      candidateCount: candidates.length,
    }));
    return reply.send(tasks);
  });

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const task = loadTask(req.params.id) ?? (
      taskRunner.currentTaskId === req.params.id ? taskRunner.getTask() : null
    );

    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return reply.send(task);
  });

  app.post<{ Params: { id: string } }>('/api/tasks/:id/stop', async (req, reply) => {
    if (taskRunner.currentTaskId !== req.params.id) {
      return reply.status(404).send({ error: 'No running task with this ID' });
    }
    taskRunner.stop();
    return reply.send({ message: 'Stop requested' });
  });

  app.get<{ Params: { id: string } }>('/api/tasks/:id/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const handler = (event: { type: string; data: unknown }) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };

    taskRunner.on('sse', handler);

    req.raw.on('close', () => {
      taskRunner.off('sse', handler);
    });
  });

  app.patch<{ Params: { id: string; articleId: string }; Body: { title: string } }>(
    '/api/tasks/:id/articles/:articleId',
    async (req, reply) => {
      const task = loadTask(req.params.id);
      if (!task) return reply.status(404).send({ error: 'Task not found' });

      const article = task.candidates.find((a) => a.id === req.params.articleId);
      if (!article) return reply.status(404).send({ error: 'Article not found' });

      const { title } = req.body || {};
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return reply.status(400).send({ error: 'title required' });
      }

      article.title = title.trim();
      saveTask(task);
      return reply.send({ id: article.id, title: article.title });
    },
  );

  app.post<{ Params: { id: string; articleId: string }; Body: { platform?: RewritePlatform } }>(
    '/api/tasks/:id/articles/:articleId/rewrite',
    async (req, reply) => {
      const task = loadTask(req.params.id);
      if (!task) return reply.status(404).send({ error: 'Task not found' });

      const article = task.candidates.find((a) => a.id === req.params.articleId);
      if (!article) return reply.status(404).send({ error: 'Article not found' });

      const settings = getSettings();
      if (!settings.aiProvider?.apiKey && !settings.deepseekApiKey) {
        return reply.status(400).send({ error: 'AI API key not configured — please go to Settings' });
      }

      const platform = (req.body as any)?.platform as RewritePlatform | undefined;
      let effectiveSettings = settings;
      if (platform && PLATFORM_PROMPTS[platform]) {
        effectiveSettings = { ...settings, rewritePrompt: PLATFORM_PROMPTS[platform].prompt };
      }

      try {
        const result = await rewriteArticle(article, effectiveSettings);
        article.rewrittenTitle = result.title;
        article.rewrittenContent = result.content;
        article.rewriteStatus = 'done';
        saveTask(task);
        return reply.send({
          id: article.id,
          rewrittenTitle: result.title,
          rewrittenContent: result.content,
          platform: platform || 'toutiao',
        });
      } catch (err) {
        article.rewriteStatus = 'failed';
        saveTask(task);
        return reply.status(500).send({ error: String(err) });
      }
    },
  );

  app.get('/api/platforms', async (_req, reply) => {
    const platforms = Object.entries(PLATFORM_PROMPTS).map(([id, { label }]) => ({ id, label }));
    return reply.send(platforms);
  });

  app.post('/api/tasks/test-rewrite', async (_req, reply) => {
    const settings = getSettings();
    if (!settings.aiProvider?.apiKey && !settings.deepseekApiKey) {
      return reply.status(400).send({ error: 'AI API key not configured' });
    }

    try {
      const testArticle = {
        id: 'test', title: '测试标题', summary: '测试', content: '这是一段用于测试AI连接的内容。',
        url: '', source: 'test', sourceId: 'test', images: [] as string[], category: '其他' as const,
        topicScore: 0, scoreReasons: [] as string[],
      };
      await rewriteArticle(testArticle, settings);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post<{ Params: { id: string }; Body: { articleIds: string[] } }>(
    '/api/tasks/:id/export',
    async (req, reply) => {
      const task = loadTask(req.params.id);
      if (!task) return reply.status(404).send({ error: 'Task not found' });

      const { articleIds } = req.body || {};
      if (!articleIds?.length) {
        return reply.status(400).send({ error: 'articleIds required' });
      }

      try {
        const settings = getSettings();
        const exportDir = exportSelected(task, articleIds, settings);
        task.status = 'exported';
        task.exportDir = exportDir;
        saveTask(task);
        return reply.send({ exportDir, count: articleIds.length });
      } catch (err) {
        return reply.status(400).send({ error: String(err) });
      }
    },
  );
}
