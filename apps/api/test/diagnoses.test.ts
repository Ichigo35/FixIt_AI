import { afterAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createApp } from '../src/app';
import { getDb } from '../src/db/client';
import { appUsers } from '../src/db/schema';
import { baseEnv, devAuth, hasDb, jpegBytes, memoryStorage } from './helpers';

const createdUsers: string[] = [];
function freshUser(): string {
  const id = `test-${crypto.randomUUID()}`;
  createdUsers.push(id);
  return id;
}

function env(extra: object = {}) {
  return { ...baseEnv, STORAGE: memoryStorage(), ...extra };
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

  it('admin : guide accessible malgré forcedStop', async () => {
    const uid = freshUser();
    const app = createApp();
    const e = env({ ADMIN_EMAILS: 'boss@example.com' });
    const auth = { ...devAuth(uid), 'x-dev-user-email': 'boss@example.com' };
    const res = await app.request(
      '/diagnoses',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...auth },
        body: JSON.stringify({
          description: 'the mains power cable is damaged and the copper wire is exposed',
        }),
      },
      e,
    );
    const body = (await res.json()) as Record<string, any>;
    expect(body.safety.forcedStop).toBe(true);

    const guide = await app.request(`/diagnoses/${body.id}/repair-guide`, { headers: auth }, e);
    expect(guide.status).toBe(200);
    const g = (await guide.json()) as any;
    expect(g.steps.length).toBeGreaterThan(0);

    const session = await app.request(
      `/diagnoses/${body.id}/repair-session`,
      { method: 'POST', headers: auth },
      e,
    );
    expect(session.status).toBe(201);
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

  it('admin (ADMIN_EMAILS) : accès illimité, quota jamais consommé', async () => {
    const uid = freshUser();
    const app = createApp();
    const e = env({ ADMIN_EMAILS: 'boss@example.com , other@x.io' });
    const auth = { ...devAuth(uid), 'x-dev-user-email': 'BOSS@example.com' };
    for (let i = 0; i < 5; i++) {
      const r = await app.request(
        '/diagnoses',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...auth },
          body: JSON.stringify({ description: `admin issue ${i}` }),
        },
        e,
      );
      expect(r.status).toBe(201);
      const body = (await r.json()) as Record<string, any>;
      expect(body.quota.used).toBe(0);
      expect(body.quota.limit).toBeNull(); // Infinity -> null en JSON
    }

    const me = await app.request('/me', { headers: auth }, e);
    const meBody = (await me.json()) as Record<string, any>;
    expect(meBody.role).toBe('admin');
    expect(meBody.quota.used).toBe(0);
  });

  it('guide illustré : chaque étape a un plan visuel, la photo reçoit un repère', async () => {
    const uid = freshUser();
    const app = createApp();
    const e = env();

    const up = await app.request(
      '/uploads',
      { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth(uid) }, body: jpegBytes },
      e,
    );
    const { id: imageId } = (await up.json()) as { id: string };

    const created = (await (
      await post(app, { description: 'the drain filter is blocked', imageIds: [imageId] }, e, uid)
    ).json()) as Record<string, any>;

    const res = await app.request(
      `/diagnoses/${created.id}/repair-guide`,
      { headers: devAuth(uid) },
      e,
    );
    expect(res.status).toBe(200);
    const guide = (await res.json()) as Record<string, any>;

    // Toutes les étapes sont illustrables (plan visuel présent).
    for (const step of guide.steps) {
      expect(step.visual).toBeTruthy();
      expect(typeof step.visual.scene).toBe('string');
    }
    // La photo du diagnostic a bien été transmise au provider -> repère posé.
    const anchored = guide.steps.filter((s: any) => s.visual.anchors.length > 0);
    expect(anchored.length).toBeGreaterThan(0);
    expect(anchored[0].visual.anchors[0].imageIndex).toBe(0);
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
    const body = (await res.json()) as Record<string, any>;

    // GET /:id renvoie l'id d'upload (utilisable par GET /uploads/:id), pas l'id de ligne.
    const detail = (await (
      await app.request(`/diagnoses/${body.id}`, { headers: devAuth(uid) }, e)
    ).json()) as Record<string, any>;
    expect(detail.input.imageIds).toEqual([up.id]);
    const media = await app.request(`/uploads/${detail.input.imageIds[0]}`, { headers: devAuth(uid) }, e);
    expect(media.status).toBe(200);
  });

  it('avec vidéo : upload puis diagnostic, videoIds persistés et purgés au delete', async () => {
    const uid = freshUser();
    const e = env();
    const store = (e.STORAGE as ReturnType<typeof memoryStorage>)._store;
    const app = createApp();

    const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const up = (await (
      await app.request(
        '/uploads',
        { method: 'POST', headers: { 'content-type': 'video/mp4', ...devAuth(uid) }, body: mp4 },
        e,
      )
    ).json()) as { id: string; kind: string };
    expect(up.kind).toBe('video');

    const res = await post(
      app,
      { description: 'it rattles loudly when it spins up', videoIds: [up.id] },
      e,
      uid,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    expect(body.input.videoIds).toEqual([up.id]);

    const detail = (await (
      await app.request(`/diagnoses/${body.id}`, { headers: devAuth(uid) }, e)
    ).json()) as Record<string, any>;
    expect(detail.input.videoIds).toEqual([up.id]);

    const del = await app.request(`/diagnoses/${body.id}`, { method: 'DELETE', headers: devAuth(uid) }, e);
    expect(del.status).toBe(204);
    expect(store.has(`uploads/${up.id}`)).toBe(false);
  });

  it('DELETE /diagnoses/:id purge aussi l\'image liée du stockage objet', async () => {
    const uid = freshUser();
    const e = env();
    const store = (e.STORAGE as ReturnType<typeof memoryStorage>)._store;
    const app = createApp();

    const up = (await (
      await app.request(
        '/uploads',
        { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth(uid) }, body: jpegBytes },
        e,
      )
    ).json()) as { id: string };
    const diag = (await (
      await post(app, { description: 'leaking pipe under sink', imageIds: [up.id] }, e, uid)
    ).json()) as { id: string };
    expect(store.has(`uploads/${up.id}`)).toBe(true);

    const del = await app.request(`/diagnoses/${diag.id}`, { method: 'DELETE', headers: devAuth(uid) }, e);
    expect(del.status).toBe(204);
    expect(store.has(`uploads/${up.id}`)).toBe(false);
  });
});
