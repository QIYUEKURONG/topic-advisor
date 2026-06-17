import type { FastifyInstance } from 'fastify';
import { getSettings, updateSettings } from '../config/settings.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async (_req, reply) => {
    return reply.send(getSettings());
  });

  app.patch('/api/settings', async (req, reply) => {
    const patch = req.body as Record<string, unknown>;
    const updated = updateSettings(patch as any);
    return reply.send(updated);
  });

  app.get('/api/health', async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
