import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { baseEnv, jpegBytes, memoryBucket } from './helpers';

async function post(app: ReturnType<typeof createApp>, body: unknown, env: object) {
  return app.request(
    '/diagnoses',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

// Sans GEMINI_API_KEY -> MockProvider déterministe.
describe('POST /diagnoses (provider mock)', () => {
  it('description seule -> 201 avec diagnosis + safety + repairability', async () => {
    const app = createApp();
    const res = await post(app, { description: 'the wooden chair leg snapped off' }, baseEnv);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    expect(body.diagnosis.problem).toBeTruthy();
    expect(body.safety.recommendation).toBeDefined();
    expect(body.repairability.score).toBeGreaterThanOrEqual(0);
    expect(body.aiProvider).toBe('mock');
  });

  it('description dangereuse (câble secteur) -> forcedStop + PROFESSIONAL', async () => {
    const app = createApp();
    const res = await post(
      app,
      { description: 'the mains power cable is damaged and the copper wire is exposed' },
      baseEnv,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    expect(body.safety.forcedStop).toBe(true);
    expect(body.safety.recommendation).toBe('PROFESSIONAL');
    expect(body.safety.riskLevel).toBe('CRITICAL');
    expect(body.repairability.score).toBeLessThanOrEqual(12);
  });

  it('ni photo ni description -> 400', async () => {
    const app = createApp();
    const res = await post(app, { description: '   ' }, baseEnv);
    expect(res.status).toBe(400);
    expect((await res.json()) as any).toMatchObject({ error: 'need_photo_or_description' });
  });

  it('catégorie invalide -> 400 invalid_request', async () => {
    const app = createApp();
    const res = await post(app, { description: 'x'.repeat(20), category: 'spaceship' }, baseEnv);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('invalid_request');
  });

  it('imageId inconnu -> 400 image_not_found', async () => {
    const app = createApp();
    const res = await post(
      app,
      { description: 'leak', imageIds: ['11111111-1111-1111-1111-111111111111'] },
      { ...baseEnv, IMAGES: memoryBucket() },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('image_not_found');
  });

  it('repair-guide : 409 si forcedStop, sinon guide pas-à-pas', async () => {
    const IMAGES = memoryBucket();
    const env = { ...baseEnv, IMAGES };
    const app = createApp();

    // cas dangereux -> forcedStop
    const danger = (await (
      await post(app, { description: 'the mains power cord is cut and copper is exposed' }, env)
    ).json()) as { id: string; safety: { forcedStop: boolean } };
    expect(danger.safety.forcedStop).toBe(true);
    const blocked = await app.request(`/diagnoses/${danger.id}/repair-guide`, {}, env);
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as any).reason).toBe('forced_stop');

    // cas bénin -> guide
    const ok = (await (
      await post(app, { description: 'the cabinet door hinge is loose and squeaks' }, env)
    ).json()) as { id: string };
    const guideRes = await app.request(`/diagnoses/${ok.id}/repair-guide`, {}, env);
    expect(guideRes.status).toBe(200);
    const guide = (await guideRes.json()) as any;
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.steps[0].index).toBe(0);

    // mise en cache : deuxième appel identique
    const again = await app.request(`/diagnoses/${ok.id}/repair-guide`, {}, env);
    expect(again.status).toBe(200);
    expect(((await again.json()) as any).summary).toBe(guide.summary);
  });

  it('repair-guide : 404 si diagnostic inconnu', async () => {
    const app = createApp();
    const res = await app.request(
      '/diagnoses/00000000-0000-0000-0000-000000000000/repair-guide',
      {},
      { ...baseEnv, IMAGES: memoryBucket() },
    );
    expect(res.status).toBe(404);
  });

  it('avec image + persistance, puis GET puis DELETE', async () => {
    const IMAGES = memoryBucket();
    const env = { ...baseEnv, IMAGES };
    const app = createApp();

    // upload d'abord
    const up = (await (
      await app.request(
        '/uploads',
        { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpegBytes },
        env,
      )
    ).json()) as { id: string };

    const created = await post(app, { description: 'fridge not cooling', imageIds: [up.id] }, env);
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string; diagnosis: { confidence: number } };
    expect(body.diagnosis.confidence).toBeGreaterThan(0);

    const got = await app.request(`/diagnoses/${body.id}`, {}, env);
    expect(got.status).toBe(200);
    expect(((await got.json()) as any).id).toBe(body.id);

    const del = await app.request(`/diagnoses/${body.id}`, { method: 'DELETE' }, env);
    expect(del.status).toBe(204);
    const gone = await app.request(`/diagnoses/${body.id}`, {}, env);
    expect(gone.status).toBe(404);
  });
});
