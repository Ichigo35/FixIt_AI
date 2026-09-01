import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './auth/middleware';
import { getDb } from './db/client';
import { ensureUser, getQuota } from './db/repos';
import { diagnoses } from './routes/diagnoses';
import { uploads } from './routes/uploads';
import { getStorage } from './storage';
import type { AppEnv } from './types';

export function createApp() {
  const app = new Hono<AppEnv>();

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
        storage: getStorage(c.env) !== null,
        auth: Boolean(c.env.STACK_JWKS_URL),
      },
    }),
  );

  // Profil + quota de l'utilisateur courant.
  app.get('/me', requireAuth, async (c) => {
    const db = getDb(c.env);
    const userId = c.get('userId');
    await ensureUser(db, userId, c.get('userEmail'));
    const quota = await getQuota(db, userId);
    return c.json({
      id: userId,
      email: c.get('userEmail'),
      plan: quota.plan,
      quota: { used: quota.used, limit: quota.limit },
    });
  });

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
