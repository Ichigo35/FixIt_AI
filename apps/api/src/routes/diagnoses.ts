import { Hono } from 'hono';
import {
  assessDiagnosis,
  createDiagnosisRequestSchema,
  diagnosisResultSchema,
  historyRequestSchema,
  type DiagnosisResult,
} from '@fixit/shared';
import { requireAuth } from '../auth/middleware';
import { rateLimit } from '../middleware/rateLimit';
import { getDb } from '../db/client';
import {
  addHistory,
  consumeQuota,
  deleteDiagnosis,
  ensureUser,
  getDiagnosis,
  getRepairGuide,
  insertDiagnosis,
  listDiagnoses,
  listHistory,
  saveRepairGuide,
  type ImageMeta,
} from '../db/repos';
import { AIProviderError, getAIProvider } from '../providers';
import type { DiagnoseImage } from '../providers/types';
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
  await ensureUser(db, userId, c.get('userEmail'));

  const quota = await consumeQuota(db, userId);
  if (!quota.allowed) {
    return c.json({ error: 'quota_exceeded', used: quota.used, limit: quota.limit }, 429);
  }

  // Récupération des images depuis le stockage objet (+ métadonnées pour diagnosis_images).
  const images: DiagnoseImage[] = [];
  const imageMeta: ImageMeta[] = [];
  if (req.imageIds.length > 0) {
    const storage = getStorage(c.env);
    if (!storage) return c.json({ error: 'storage_unavailable' }, 503);
    for (const id of req.imageIds) {
      const key = `uploads/${id}`;
      const obj = await storage.get(key);
      if (!obj) return c.json({ error: 'image_not_found', id }, 400);
      const data = obj.data;
      const contentType = obj.contentType || 'image/jpeg';
      images.push({ contentType, data });
      imageMeta.push({
        r2Key: key,
        kind: obj.metadata.kind ?? 'problem',
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
