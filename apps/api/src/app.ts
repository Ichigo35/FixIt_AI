import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { diagnoses } from './routes/diagnoses';
import { uploads } from './routes/uploads';

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));

  app.get('/', (c) => c.json({ name: 'FixIt AI API', status: 'ok' }));

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      env: c.env.APP_ENV ?? 'unknown',
      time: new Date().toISOString(),
      services: {
        gemini: Boolean(c.env.GEMINI_API_KEY),
        database: Boolean(c.env.DATABASE_URL),
        storage: Boolean(c.env.IMAGES),
      },
    }),
  );

  app.route('/uploads', uploads);
  app.route('/diagnoses', diagnoses);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
