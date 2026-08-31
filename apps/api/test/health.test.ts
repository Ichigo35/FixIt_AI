import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const env = { APP_ENV: 'test', FREE_MONTHLY_DIAGNOSES: '3', GEMINI_MODEL: 'gemini-3.6-flash' };

describe('API', () => {
  it('GET /health renvoie ok', async () => {
    const app = createApp();
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; services: Record<string, boolean> };
    expect(body.status).toBe('ok');
    expect(body.services).toHaveProperty('gemini');
  });

  it('route inconnue -> 404 JSON', async () => {
    const app = createApp();
    const res = await app.request('/nope', {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
