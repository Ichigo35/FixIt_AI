import { Hono } from 'hono';
import {
  assessDiagnosis,
  createDiagnosisRequestSchema,
  diagnosisResultSchema,
  historyRequestSchema,
  verifyStepRequestSchema,
  type DiagnosisResult,
  type RepairCheck,
  type RepairSessionStatus,
} from '@fixit/shared';
import { isAdminEmail } from '../auth/admin';
import { requireAuth } from '../auth/middleware';
import { rateLimit } from '../middleware/rateLimit';
import { getDb } from '../db/client';
import {
  addHistory,
  consumeQuota,
  deleteDiagnosis,
  ensureRepairSession,
  ensureUser,
  getDiagnosis,
  getRepairGuide,
  getRepairSession,
  insertDiagnosis,
  listDiagnoses,
  listHistory,
  recordRepairCheck,
  saveRepairGuide,
  type ImageMeta,
} from '../db/repos';
import { AIProviderError, getAIProvider } from '../providers';
import type { DiagnoseImage, DiagnoseVideo } from '../providers/types';
import { getStorage } from '../storage';
import type { AppEnv } from '../types';

export const diagnoses = new Hono<AppEnv>();
diagnoses.use('*', requireAuth);

/** POST /diagnoses — pipeline complet + quota + persistance Neon. */
diagnoses.post('/', rateLimit('DIAGNOSE_RL'), async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createDiagnosisRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  const req = parsed.data;
  if (!req.description.trim() && req.imageIds.length === 0) {
    return c.json({ error: 'need_photo_or_description' }, 400);
  }

  const db = getDb(c.env);
  const userId = c.get('userId');
  const email = c.get('userEmail');
  await ensureUser(db, userId, email, email ? isAdminEmail(c.env, email) : undefined);

  const quota = await consumeQuota(db, userId);
  if (!quota.allowed) {
    return c.json({ error: 'quota_exceeded', used: quota.used, limit: quota.limit }, 429);
  }

  // Récupération des médias depuis le stockage objet (+ métadonnées pour diagnosis_images).
  const images: DiagnoseImage[] = [];
  const videos: DiagnoseVideo[] = [];
  const imageMeta: ImageMeta[] = [];
  const mediaIds = [...req.imageIds, ...req.videoIds];
  if (mediaIds.length > 0) {
    const storage = getStorage(c.env);
    if (!storage) return c.json({ error: 'storage_unavailable' }, 503);
    for (const id of mediaIds) {
      const key = `uploads/${id}`;
      const obj = await storage.get(key);
      if (!obj) return c.json({ error: 'image_not_found', id }, 400);
      if (obj.metadata.userid && obj.metadata.userid !== userId) {
        return c.json({ error: 'image_not_found', id }, 400);
      }
      const data = obj.data;
      const contentType = obj.contentType || 'image/jpeg';
      const isVideo = contentType.startsWith('video/') || obj.metadata.kind === 'video';
      if (isVideo) {
        videos.push({ contentType, data });
      } else {
        images.push({ contentType, data });
      }
      imageMeta.push({
        r2Key: key,
        kind: isVideo ? 'video' : obj.metadata.kind ?? 'problem',
        contentType,
        bytes: data.byteLength,
      });
    }
  }

  const provider = getAIProvider(c.env);
  let raw;
  try {
    raw = await provider.diagnose({
      description: req.description,
      category: req.category ?? null,
      brand: req.brand ?? null,
      model: req.model ?? null,
      images,
      videos,
    });
  } catch (err) {
    if (err instanceof AIProviderError) {
      return c.json(
        { error: err.code, message: err.message },
        err.code === 'ai_request_failed' ? 502 : 422,
      );
    }
    throw err;
  }

  const { safety, repairability } = assessDiagnosis({
    diagnosis: raw,
    category: req.category ?? null,
    description: req.description,
  });

  const result: DiagnosisResult = diagnosisResultSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    category: req.category ?? null,
    input: {
      description: req.description,
      brand: req.brand ?? null,
      model: req.model ?? null,
      imageIds: req.imageIds,
      videoIds: req.videoIds,
    },
    diagnosis: raw,
    safety,
    repairability,
  } satisfies DiagnosisResult);

  await insertDiagnosis(db, userId, result, provider.name, provider.model, imageMeta);

  return c.json(
    { ...result, aiProvider: provider.name, aiModel: provider.model, quota },
    201,
  );
});

diagnoses.get('/', async (c) => {
  const db = getDb(c.env);
  const items = await listDiagnoses(db, c.get('userId'));
  return c.json({ items });
});

diagnoses.get('/:id', async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const found = await getDiagnosis(db, userId, id);
  if (!found) return c.json({ error: 'not_found' }, 404);
  const history = await listHistory(db, userId, id);
  return c.json({ ...found, history });
});

/** POST /diagnoses/:id/history — issue de réparation + feedback + avant/après. */
diagnoses.post('/:id/history', async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');

  const diagnosis = await getDiagnosis(db, userId, id);
  if (!diagnosis) return c.json({ error: 'not_found' }, 404);

  const parsed = historyRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  // Résout un imageId -> clé de stockage en vérifiant l'appartenance.
  const storage = getStorage(c.env);
  const resolveKey = async (imageId?: string | null): Promise<string | null> => {
    if (!imageId || !storage) return null;
    const obj = await storage.get(`uploads/${imageId}`);
    if (!obj) return null;
    if (obj.metadata.userid && obj.metadata.userid !== userId) return null;
    return `uploads/${imageId}`;
  };

  await addHistory(db, userId, id, {
    outcome: body.outcome,
    feedbackWorked: body.feedbackWorked ?? null,
    feedbackNote: body.feedbackNote ?? null,
    beforeR2Key: await resolveKey(body.beforeImageId),
    afterR2Key: await resolveKey(body.afterImageId),
  });

  const history = await listHistory(db, userId, id);
  return c.json({ ok: true, history }, 201);
});

diagnoses.delete('/:id', async (c) => {
  const db = getDb(c.env);
  const keys = await deleteDiagnosis(db, c.get('userId'), c.req.param('id'));
  const storage = getStorage(c.env);
  if (storage) {
    await Promise.all(keys.map((k) => storage.delete(k)));
  }
  return c.body(null, 204);
});

/** GET /diagnoses/:id/repair-guide — génère (et met en cache) le guide pas-à-pas. */
diagnoses.get('/:id/repair-guide', rateLimit('DIAGNOSE_RL'), async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');

  const diagnosis = await getDiagnosis(db, userId, id);
  if (!diagnosis) return c.json({ error: 'not_found' }, 404);
  if (diagnosis.safety.forcedStop) {
    return c.json({ error: 'guide_unavailable', reason: 'forced_stop', safety: diagnosis.safety }, 409);
  }

  const cached = await getRepairGuide(db, id);
  if (cached) return c.json(cached);

  const provider = getAIProvider(c.env);
  let guide;
  try {
    guide = await provider.generateRepairGuide({
      diagnosis: diagnosis.diagnosis,
      category: diagnosis.category,
      description: diagnosis.input.description,
      brand: diagnosis.input.brand,
      model: diagnosis.input.model,
    });
  } catch (err) {
    if (err instanceof AIProviderError) {
      return c.json(
        { error: err.code, message: err.message },
        err.code === 'ai_request_failed' ? 502 : 422,
      );
    }
    throw err;
  }

  await saveRepairGuide(db, id, guide, provider.name, provider.model);
  return c.json(guide);
});

/* --------------------------- Réparation interactive --------------------------- */

/** GET /diagnoses/:id/repair-session — état de la session (404 si aucune). */
diagnoses.get('/:id/repair-session', async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const diagnosis = await getDiagnosis(db, userId, id);
  if (!diagnosis) return c.json({ error: 'not_found' }, 404);
  const session = await getRepairSession(db, userId, id);
  if (!session) return c.json({ error: 'not_found' }, 404);
  return c.json(session);
});

/** POST /diagnoses/:id/repair-session — démarre (ou récupère) la session interactive. */
diagnoses.post('/:id/repair-session', async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');

  const diagnosis = await getDiagnosis(db, userId, id);
  if (!diagnosis) return c.json({ error: 'not_found' }, 404);
  if (diagnosis.safety.forcedStop) {
    return c.json({ error: 'session_unavailable', reason: 'forced_stop', safety: diagnosis.safety }, 409);
  }
  const guide = await getRepairGuide(db, id);
  if (!guide) return c.json({ error: 'guide_required' }, 409);

  const session = await ensureRepairSession(db, userId, id, guide.steps.length);
  return c.json(session, 201);
});

/** POST /diagnoses/:id/repair-session/verify — vérifie une photo contre une étape. */
diagnoses.post('/:id/repair-session/verify', rateLimit('DIAGNOSE_RL'), async (c) => {
  const db = getDb(c.env);
  const userId = c.get('userId');
  const id = c.req.param('id');

  const diagnosis = await getDiagnosis(db, userId, id);
  if (!diagnosis) return c.json({ error: 'not_found' }, 404);
  if (diagnosis.safety.forcedStop) {
    return c.json({ error: 'session_unavailable', reason: 'forced_stop', safety: diagnosis.safety }, 409);
  }

  const parsed = verifyStepRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  const { stepIndex, imageId, note } = parsed.data;

  const guide = await getRepairGuide(db, id);
  if (!guide) return c.json({ error: 'guide_required' }, 409);
  const step = guide.steps[stepIndex];
  if (!step) return c.json({ error: 'step_out_of_range', stepCount: guide.steps.length }, 400);

  const storage = getStorage(c.env);
  if (!storage) return c.json({ error: 'storage_unavailable' }, 503);
  const key = `uploads/${imageId}`;
  const obj = await storage.get(key);
  if (!obj) return c.json({ error: 'image_not_found', id: imageId }, 400);
  if (obj.metadata.userid && obj.metadata.userid !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const session = await ensureRepairSession(db, userId, id, guide.steps.length);

  const provider = getAIProvider(c.env);
  let raw;
  try {
    raw = await provider.verifyStep({
      step,
      stepNumber: stepIndex + 1,
      stepCount: guide.steps.length,
      guideSummary: guide.summary,
      diagnosis: diagnosis.diagnosis,
      category: diagnosis.category,
      note,
      image: { contentType: obj.contentType || 'image/jpeg', data: obj.data },
    });
  } catch (err) {
    if (err instanceof AIProviderError) {
      return c.json(
        { error: err.code, message: err.message },
        err.code === 'ai_request_failed' ? 502 : 422,
      );
    }
    throw err;
  }

  const check: RepairCheck = {
    stepIndex,
    imageId,
    verdict: raw.verdict,
    summary: raw.summary,
    advice: raw.advice,
    escalate: raw.escalate,
    createdAt: new Date().toISOString(),
  };

  const advanced = raw.verdict === 'pass' ? Math.max(session.currentStep, stepIndex + 1) : session.currentStep;
  const status: RepairSessionStatus = advanced >= guide.steps.length ? 'completed' : 'active';
  const updated = await recordRepairCheck(db, session.id, check, advanced, status);

  return c.json({ check, session: updated }, 201);
});
