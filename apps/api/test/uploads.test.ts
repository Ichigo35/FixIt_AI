import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { baseEnv, devAuth, memoryStorage } from './helpers';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const uid = 'test-uploads';

function env(extra: object = {}) {
  return { ...baseEnv, STORAGE: memoryStorage(), ...extra };
}

describe('POST /uploads', () => {
  it('sans auth -> 401', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg },
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('stocke une image JPEG et renvoie un id', async () => {
    const e = env();
    const app = createApp();
    const res = await app.request(
      '/uploads?kind=problem',
      { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth(uid) }, body: jpeg },
      e,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; kind: string; bytes: number };
    expect(body.kind).toBe('problem');
    expect(body.bytes).toBe(jpeg.byteLength);
    expect((e.STORAGE as ReturnType<typeof memoryStorage>)._store.has(`uploads/${body.id}`)).toBe(true);
  });

  it('refuse un type non image (415)', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'application/pdf', ...devAuth(uid) }, body: jpeg },
      env(),
    );
    expect(res.status).toBe(415);
  });

  it('refuse un corps vide (400)', async () => {
    const app = createApp();
    const res = await app.request(
      '/uploads',
      {
        method: 'POST',
        headers: { 'content-type': 'image/png', ...devAuth(uid) },
        body: new Uint8Array(),
      },
      env(),
    );
    expect(res.status).toBe(400);
  });

  it('GET refuse l\'image d\'un autre utilisateur (403)', async () => {
    const e = env();
    const app = createApp();
    const created = (await (
      await app.request(
        '/uploads',
        { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth(uid) }, body: jpeg },
        e,
      )
    ).json()) as { id: string };

    const mine = await app.request(`/uploads/${created.id}`, { headers: devAuth(uid) }, e);
    expect(mine.status).toBe(200);

    const other = await app.request(
      `/uploads/${created.id}`,
      { headers: devAuth('test-someone-else') },
      e,
    );
    expect(other.status).toBe(403);
  });
});
