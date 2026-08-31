import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

/** R2Bucket minimal en mémoire pour les tests. */
function memoryBucket() {
  const store = new Map<string, { body: Uint8Array; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }>();
  return {
    async put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
      store.set(key, { body: new Uint8Array(value), ...opts });
    },
    async get(key: string) {
      const found = store.get(key);
      if (!found) return null;
      return {
        body: found.body,
        httpMetadata: found.httpMetadata,
        httpEtag: '"test"',
        customMetadata: found.customMetadata,
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
    _store: store,
  };
}

const baseEnv = { APP_ENV: 'test', FREE_MONTHLY_DIAGNOSES: '3', GEMINI_MODEL: 'gemini-2.5-flash' };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('POST /uploads', () => {
  it('stocke une image JPEG et renvoie un id', async () => {
    const IMAGES = memoryBucket();
    const app = createApp();
    const res = await app.request(
      '/uploads?kind=problem',
      { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg },
      { ...baseEnv, IMAGES },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; kind: string; bytes: number };
    expect(body.kind).toBe('problem');
    expect(body.bytes).toBe(jpeg.byteLength);
    expect(IMAGES._store.has(`uploads/${body.id}`)).toBe(true);
  });

  it('refuse un type non image (415)', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: jpeg },
      { ...baseEnv, IMAGES: memoryBucket() },
    );
    expect(res.status).toBe(415);
  });

  it('refuse un corps vide (400)', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'image/png' }, body: new Uint8Array() },
      { ...baseEnv, IMAGES: memoryBucket() },
    );
    expect(res.status).toBe(400);
  });

  it('503 si le stockage n\'est pas configuré', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg },
      baseEnv,
    );
    expect(res.status).toBe(503);
  });

  it('GET puis DELETE d\'une image', async () => {
    const IMAGES = memoryBucket();
    const env = { ...baseEnv, IMAGES };
    const app = createApp();
    const created = (await (
      await app.request(
        '/uploads',
        { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg },
        env,
      )
    ).json()) as { id: string };

    const get = await app.request(`/uploads/${created.id}`, {}, env);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/jpeg');

    const del = await app.request(`/uploads/${created.id}`, { method: 'DELETE' }, env);
    expect(del.status).toBe(204);

    const gone = await app.request(`/uploads/${created.id}`, {}, env);
    expect(gone.status).toBe(404);
  });
});
