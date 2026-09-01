import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { AppEnv } from '../types';

let jwksCache: { url: string; jwks: JWTVerifyGetKey } | null = null;

function getJwks(url: string): JWTVerifyGetKey {
  if (!jwksCache || jwksCache.url !== url) {
    jwksCache = { url, jwks: createRemoteJWKSet(new URL(url)) };
  }
  return jwksCache.jwks;
}

function stackIssuer(env: Env): string {
  return `https://api.stack-auth.com/api/v1/projects/${env.STACK_PROJECT_ID}`;
}

/**
 * Vérifie le JWT Neon Auth (Stack) et pose `userId` / `userEmail`.
 * En dev (APP_ENV != production), l'en-tête `x-dev-user-id` permet de tester
 * sans passer par le flux d'authentification.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');

  if (c.env.APP_ENV !== 'production') {
    const devUser = c.req.header('x-dev-user-id');
    if (devUser && !header) {
      c.set('userId', devUser);
      c.set('userEmail', c.req.header('x-dev-user-email') ?? null);
      return next();
    }
  }

  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  if (!c.env.STACK_JWKS_URL || !c.env.STACK_PROJECT_ID) {
    return c.json({ error: 'auth_not_configured' }, 503);
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), getJwks(c.env.STACK_JWKS_URL), {
      issuer: stackIssuer(c.env),
      audience: c.env.STACK_PROJECT_ID,
    });
    if (!payload.sub) return c.json({ error: 'invalid_token' }, 401);
    c.set('userId', payload.sub);
    c.set('userEmail', typeof payload.email === 'string' ? payload.email : null);
  } catch {
    return c.json({ error: 'invalid_token' }, 401);
  }

  await next();
};
