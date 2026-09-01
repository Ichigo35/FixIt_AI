import { afterAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createApp } from '../src/app';
import { getDb } from '../src/db/client';
import { appUsers } from '../src/db/schema';
import { baseEnv, devAuth, hasDb, jpegBytes, memoryBucket } from './helpers';

const createdUsers: string[] = [];
function freshUser(): string {
  const id = `test-${crypto.randomUUID()}`;
  createdUsers.push(id);
  return id;
}

function env(extra: object = {}) {
  return { ...baseEnv, IMAGES: memoryBucket(), ...extra };
}

async function post(app: ReturnType<typeof createApp>, body: unknown, e: object, user: string) {
  return app.request(
    '/diagnoses',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...devAuth(user) },
      body: JSON.stringify(body),
    },
    e,
  );
}

afterAll(async () => {
  if (!hasDb || createdUsers.length === 0) return;
  const db = getDb(baseEnv as never);
  await db.delete(appUsers).where(inArray(appUsers.id, createdUsers));
});

// Sans GEMINI_API_KEY -> MockProvider. Nécessite Neon (DATABASE_URL dans .dev.vars).
describe.runIf(hasDb)('POST /diagnoses (mock + Neon)', () => {
  it('description seule -> 201 + persistance + quota + liste', async () => {
    const uid = freshUser();
    const app = createApp();
    const res = await post(app, { description: 'the wooden chair leg snapped off' }, env(), uid);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    expect(body.diagnosis.problem).toBeTruthy();
    expect(body.quota.used).toBe(1);

    const list = await app.request('/diagnoses', { headers: devAuth(uid) }, env());
    const listed = (await list.json()) as { items: unknown[] };
    expect(listed.items.length).toBe(1);
  });

  it('câble secteur -> forcedStop + guide 409', async () => {
    const uid = freshUser();
    const app = createApp();
    const res = await post(
      app,
      { description: 'the mains power cable is damaged and the copper wire is exposed' },
      env(),
      uid,
    );
    const body = (await res.json()) as Record<string, any>;
    expect(body.safety.forcedStop).toBe(true);
    expect(body.safety.recommendation).toBe('PROFESSIONAL');

    const guide = await app.request(
      `/diagnoses/${body.id}/repair-guide`,
      { headers: devAuth(uid) },
      env(),
    );
    expect(guide.status).toBe(409);
  });

  it('quota FREE : 4e diagnostic -> 429', async () => {
    const uid = freshUser();
    const app = createApp();
    for (let i = 0; i < 3; i++) {
      const r = await post(app, { description: `minor issue number ${i}` }, env(), uid);
      expect(r.status).toBe(201);
    }
    const denied = await post(app, { description: 'one too many' }, env(), uid);
    expect(denied.status).toBe(429);
    expect(((await denied.json()) as any).error).toBe('quota_exceeded');
  });

  it('isolation : un autre utilisateur ne voit pas le diagnostic (404)', async () => {
    const uid = freshUser();
    const intruder = freshUser();
    const app = createApp();
    const created = (await (
      await post(app, { description: 'squeaky cabinet hinge' }, env(), uid)
    ).json()) as { id: string };

    const asOther = await app.request(
      `/diagnoses/${created.id}`,
      { headers: devAuth(intruder) },
      env(),
    );
    expect(asOther.status).toBe(404);
  });

  it('guide pas-à-pas pour un cas bénin', async () => {
    const uid = freshUser();
    const app = createApp();
    const created = (await (
      await post(app, { description: 'the cabinet door hinge is loose and squeaks' }, env(), uid)
    ).json()) as { id: string };
    const guideRes = await app.request(
      `/diagnoses/${created.id}/repair-guide`,
      { headers: devAuth(uid) },
      env(),
    );
    expect(guideRes.status).toBe(200);
    const guide = (await guideRes.json()) as any;
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.steps[0].index).toBe(0);
  });

  it('image inconnue -> 400', async () => {
    const uid = freshUser();
    const app = createApp();
    const res = await post(
      app,
      { description: 'leak', imageIds: ['11111111-1111-1111-1111-111111111111'] },
      env(),
      uid,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('image_not_found');
  });

  it('historique : feedback + outcome + statut mis à jour', async () => {
    const uid = freshUser();
    const app = createApp();
    const created = (await (
      await post(app, { description: 'loose towel rail on the wall' }, env(), uid)
    ).json()) as { id: string };

    const hist = await app.request(
      `/diagnoses/${created.id}/history`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...devAuth(uid) },
        body: JSON.stringify({ outcome: 'fixed', feedbackWorked: true, feedbackNote: 'easy fix' }),
      },
      env(),
    );
    expect(hist.status).toBe(201);
    expect(((await hist.json()) as any).history.length).toBe(1);

    const detail = (await (
      await app.request(`/diagnoses/${created.id}`, { headers: devAuth(uid) }, env())
    ).json()) as any;
    expect(detail.status).toBe('fixed');
    expect(detail.history[0].outcome).toBe('fixed');

    const list = (await (
      await app.request('/diagnoses', { headers: devAuth(uid) }, env())
    ).json()) as any;
    expect(list.items[0].status).toBe('fixed');
  });

  it('historique : 404 si le diagnostic n\'appartient pas à l\'utilisateur', async () => {
    const uid = freshUser();
    const other = freshUser();
    const app = createApp();
    const created = (await (
      await post(app, { description: 'wobbly table' }, env(), uid)
    ).json()) as { id: string };
    const res = await app.request(
      `/diagnoses/${created.id}/history`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...devAuth(other) },
        body: JSON.stringify({ outcome: 'fixed' }),
      },
      env(),
    );
    expect(res.status).toBe(404);
  });

  it('avec image : upload puis diagnostic', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const up = (await (
      await app.request(
        '/uploads',
        {
          method: 'POST',
          headers: { 'content-type': 'image/jpeg', ...devAuth(uid) },
          body: jpegBytes,
        },
        e,
      )
    ).json()) as { id: string };
    const res = await post(app, { description: 'fridge not cooling', imageIds: [up.id] }, e, uid);
    expect(res.status).toBe(201);
  });
});
