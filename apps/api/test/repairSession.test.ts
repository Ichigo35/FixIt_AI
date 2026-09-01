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

type App = ReturnType<typeof createApp>;

async function createDiagnosis(app: App, e: object, user: string, description: string): Promise<string> {
  const res = await app.request(
    '/diagnoses',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...devAuth(user) },
      body: JSON.stringify({ description }),
    },
    e,
  );
  return ((await res.json()) as { id: string }).id;
}

async function generateGuide(app: App, e: object, user: string, id: string) {
  return app.request(`/diagnoses/${id}/repair-guide`, { headers: devAuth(user) }, e);
}

async function uploadImage(app: App, e: object, user: string): Promise<string> {
  const res = await app.request(
    '/uploads?kind=step',
    { method: 'POST', headers: { 'content-type': 'image/jpeg', ...devAuth(user) }, body: jpegBytes },
    e,
  );
  return ((await res.json()) as { id: string }).id;
}

async function verify(
  app: App,
  e: object,
  user: string,
  id: string,
  body: { stepIndex: number; imageId: string; note?: string },
) {
  return app.request(
    `/diagnoses/${id}/repair-session/verify`,
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

describe.runIf(hasDb)('réparation interactive (mock + Neon)', () => {
  it('POST /repair-session : 409 sans guide, puis 201 avec stepCount', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'the cabinet door hinge is loose and squeaks');

    const noGuide = await app.request(
      `/diagnoses/${id}/repair-session`,
      { method: 'POST', headers: devAuth(uid) },
      e,
    );
    expect(noGuide.status).toBe(409);
    expect(((await noGuide.json()) as any).error).toBe('guide_required');

    expect((await generateGuide(app, e, uid, id)).status).toBe(200);

    const started = await app.request(
      `/diagnoses/${id}/repair-session`,
      { method: 'POST', headers: devAuth(uid) },
      e,
    );
    expect(started.status).toBe(201);
    const session = (await started.json()) as any;
    expect(session.stepCount).toBeGreaterThan(0);
    expect(session.currentStep).toBe(0);
    expect(session.status).toBe('active');
  });

  it('verify "pass" fait avancer currentStep ; "retry" ne l\'avance pas', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'loose towel rail on the wall');
    await generateGuide(app, e, uid, id);

    const img1 = await uploadImage(app, e, uid);
    const passRes = await verify(app, e, uid, id, { stepIndex: 0, imageId: img1 });
    expect(passRes.status).toBe(201);
    const passBody = (await passRes.json()) as any;
    expect(passBody.check.verdict).toBe('pass');
    expect(passBody.session.currentStep).toBe(1);

    const img2 = await uploadImage(app, e, uid);
    const retryRes = await verify(app, e, uid, id, {
      stepIndex: 1,
      imageId: img2,
      note: "the bracket won't sit flush",
    });
    const retryBody = (await retryRes.json()) as any;
    expect(retryBody.check.verdict).toBe('retry');
    expect(retryBody.session.currentStep).toBe(1);
    expect(retryBody.session.checks.length).toBe(2);
  });

  it('verify "unsafe" -> escalate true', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'the drawer runner is bent');
    await generateGuide(app, e, uid, id);
    const img = await uploadImage(app, e, uid);
    const res = await verify(app, e, uid, id, {
      stepIndex: 0,
      imageId: img,
      note: 'I can see a spark when I plug it in',
    });
    const body = (await res.json()) as any;
    expect(body.check.verdict).toBe('unsafe');
    expect(body.check.escalate).toBe(true);
  });

  it('passer toutes les étapes -> statut completed', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'squeaky cabinet hinge needs oil');
    const guide = (await (await generateGuide(app, e, uid, id)).json()) as any;

    let session: any;
    for (let i = 0; i < guide.steps.length; i++) {
      const img = await uploadImage(app, e, uid);
      session = (await (await verify(app, e, uid, id, { stepIndex: i, imageId: img })).json()) as any;
    }
    expect(session.session.status).toBe('completed');
    expect(session.session.currentStep).toBe(guide.steps.length);
  });

  it('isolation : un autre utilisateur ne peut pas vérifier (404)', async () => {
    const uid = freshUser();
    const intruder = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'wobbly chair joint');
    await generateGuide(app, e, uid, id);
    const img = await uploadImage(app, e, intruder);
    const res = await verify(app, e, intruder, id, { stepIndex: 0, imageId: img });
    expect(res.status).toBe(404);
  });

  it('diagnostic forcedStop -> POST /repair-session = 409', async () => {
    const uid = freshUser();
    const e = env();
    const app = createApp();
    const id = await createDiagnosis(
      app,
      e,
      uid,
      'the mains power cable is damaged and the copper wire is exposed',
    );
    const res = await app.request(
      `/diagnoses/${id}/repair-session`,
      { method: 'POST', headers: devAuth(uid) },
      e,
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).reason).toBe('forced_stop');
  });

  it('DELETE /diagnoses/:id purge aussi les photos de la session', async () => {
    const uid = freshUser();
    const e = env();
    const store = (e.STORAGE as ReturnType<typeof memoryStorage>)._store;
    const app = createApp();
    const id = await createDiagnosis(app, e, uid, 'kitchen drawer front came off');
    await generateGuide(app, e, uid, id);
    const img = await uploadImage(app, e, uid);
    await verify(app, e, uid, id, { stepIndex: 0, imageId: img });
    expect(store.has(`uploads/${img}`)).toBe(true);

    const del = await app.request(`/diagnoses/${id}`, { method: 'DELETE', headers: devAuth(uid) }, e);
    expect(del.status).toBe(204);
    expect(store.has(`uploads/${img}`)).toBe(false);
  });
});
