import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { baseEnv } from './helpers';

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
});
