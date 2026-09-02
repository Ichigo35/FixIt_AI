import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { MAX_VIDEO_BYTES } from '@fixit/shared';
import { isAdminEmail } from './auth/admin';
import { requireAuth } from './auth/middleware';
import { getDb } from './db/client';
import { ensureUser, getQuota } from './db/repos';
import { diagnoses } from './routes/diagnoses';
import { uploads } from './routes/uploads';
import { getStorage } from './storage';
import type { AppEnv } from './types';

export function createApp() {
  const app = new Hono<AppEnv>();

  // En-têtes de sécurité. C'est une API JSON (aucun HTML) → CSP verrouillée + pas de sniff/embed.
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'no-referrer',
      crossOriginResourcePolicy: 'same-origin',
      strictTransportSecurity: 'max-age=15552000; includeSubDomains',
      xPermittedCrossDomainPolicies: 'none',
    }),
  );

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));

  // Plafond de taille du corps (défense mémoire) : média ≤ MAX_VIDEO_BYTES (photo ≤ MAX_UPLOAD_BYTES
  // vérifié dans la route selon le Content-Type), JSON ≤ 64 Kio.
  const tooLarge = (c: Context) =>
    c.json({ error: 'payload_too_large', maxBytes: MAX_VIDEO_BYTES }, 413);
  app.use('/uploads', bodyLimit({ maxSize: MAX_VIDEO_BYTES, onError: tooLarge }));
  app.use('/diagnoses', bodyLimit({ maxSize: 64 * 1024, onError: tooLarge }));
  app.use('/diagnoses/*', bodyLimit({ maxSize: 64 * 1024, onError: tooLarge }));

  app.get('/', (c) => c.json({ name: 'FixIt AI API', status: 'ok' }));

  // Rebond OAuth : Neon Auth (Stack) exige un redirect_uri https ; on renvoie
  // l'utilisateur vers le schéma natif de l'app avec le code d'autorisation.
  app.get('/auth/callback', (c) => {
    const url = new URL(c.req.url);
    // Ne relaie que les paramètres OAuth attendus (pas d'injection arbitraire).
    const passthrough = new URLSearchParams();
    for (const k of ['code', 'state', 'error', 'error_description']) {
      const v = url.searchParams.get(k);
      if (v) passthrough.set(k, v);
    }
    const target = `fixitai://oauth?${passthrough.toString()}`;
    const attr = target.replace(/[<>"]/g, encodeURIComponent);
    // `meta refresh` = seul mécanisme de redirection non bloqué par la CSP
    // `default-src 'none'` de l'API (inline <script>/on* handlers interdits).
    // Le gros bouton est le repli fiable : un tap = geste utilisateur, toujours
    // autorisé par Chrome Custom Tabs pour ouvrir le schéma `fixitai://`.
    return c.html(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta http-equiv="refresh" content="0;url=${attr}">` +
        `<title>Signing you in…</title>` +
        `<style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;` +
        `padding:3rem 1.5rem;color:#0B1120}a.btn{display:inline-block;margin-top:1.5rem;` +
        `padding:1rem 1.75rem;background:#2563EB;color:#fff;border-radius:.75rem;` +
        `text-decoration:none;font-weight:600;font-size:1.05rem}</style></head><body>` +
        `<p>Signing you in…</p>` +
        `<a class="btn" href="${attr}">Return to FixIt AI</a>` +
        `</body></html>`,
    );
  });

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
    const email = c.get('userEmail');
    await ensureUser(db, userId, email, email ? isAdminEmail(c.env, email) : undefined);
    const quota = await getQuota(db, userId);
    return c.json({
      id: userId,
      email,
      plan: quota.plan,
      role: quota.role,
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
