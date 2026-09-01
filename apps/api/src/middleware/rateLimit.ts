import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

/**
 * Limite le débit via la primitive native Cloudflare (`[[ratelimits]]`).
 * Clé = utilisateur authentifié (fallback IP). Absente en local/tests → no-op.
 * `requireAuth` doit être monté avant.
 */
export function rateLimit(binding: 'DIAGNOSE_RL' | 'UPLOAD_RL'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const rl = c.env[binding];
    if (rl) {
      const key =
        c.get('userId') ??
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for') ??
        'anonymous';
      const { success } = await rl.limit({ key: `${binding}:${key}` });
      if (!success) {
        return c.json({ error: 'rate_limited', message: 'Too many requests. Please slow down.' }, 429);
      }
    }
    return next();
  };
}
