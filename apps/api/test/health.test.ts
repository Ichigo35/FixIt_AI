import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { baseEnv, devAuth, memoryStorage } from './helpers';

describe('API', () => {
  it('GET /health renvoie ok', async () => {
    const app = createApp();
    const res = await app.request('/health', {}, baseEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; services: Record<string, boolean> };
    expect(body.status).toBe('ok');
    expect(body.services).toHaveProperty('gemini');
    expect(body.services).toHaveProperty('auth');
  });

  it('route inconnue -> 404 JSON', async () => {
    const app = createApp();
    const res = await app.request('/nope', {}, baseEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('/diagnoses sans auth -> 401', async () => {
    const app = createApp();
    const res = await app.request('/diagnoses', {}, baseEnv);
    expect(res.status).toBe(401);
  });

  it('en-têtes de sécurité présents', async () => {
    const app = createApp();
    const res = await app.request('/health', {}, baseEnv);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('corps trop volumineux sur /uploads -> 413', async () => {
    const app = createApp();
    const huge = new Uint8Array(11 * 1024 * 1024); // > MAX_UPLOAD_BYTES (10 Mio)
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth('test-bodylimit') }, body: huge },
      { ...baseEnv, STORAGE: memoryStorage() },
    );
    expect(res.status).toBe(413);
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'payload_too_large' });
  });
});
