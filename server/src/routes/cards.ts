import type { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'node:fs';
import { generateCard, listCards, getCard, getCardImagePath } from '../services/card-generator.js';
import { CARD_LAYOUTS, CARD_STYLES } from '../services/card-templates.js';
import type { CardStyle, CardLayout } from '../services/card-templates.js';

export const cardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/cards/styles', async () => CARD_STYLES);

  app.get('/api/cards/layouts', async () => CARD_LAYOUTS);

  app.get('/api/cards', async () => listCards());

  app.get<{ Params: { id: string } }>('/api/cards/:id', async (req, reply) => {
    const card = getCard(req.params.id);
    if (!card) return reply.code(404).send({ error: 'Card not found' });
    return card;
  });

  app.get<{ Params: { id: string } }>('/api/cards/:id/image', async (req, reply) => {
    const imgPath = getCardImagePath(req.params.id);
    if (!imgPath) return reply.code(404).send({ error: 'Image not found' });
    const buf = readFileSync(imgPath);
    return reply.type('image/png').send(buf);
  });

  app.get('/api/cards/generate', async (req, reply) => {
    const { topic, style, layout } = req.query as {
      topic: string;
      style?: CardStyle;
      layout?: CardLayout;
    };

    if (!topic) return reply.code(400).send({ error: '请提供主题' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const card = await generateCard(
        topic,
        style || 'retro',
        layout || 'grid-6',
        (phase, message) => send('progress', { phase, message }),
      );
      send('complete', { cardId: card.id });
    } catch (err: any) {
      send('error', { message: err.message || '生成失败' });
    }

    reply.raw.end();
  });
};
