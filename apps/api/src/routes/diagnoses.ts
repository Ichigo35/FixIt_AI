import { Hono } from 'hono';
import {
  assessDiagnosis,
  createDiagnosisRequestSchema,
  diagnosisResultSchema,
  type DiagnosisResult,
} from '@fixit/shared';
import type { Env } from '../env';
import { AIProviderError, getAIProvider } from '../providers';
import type { DiagnoseImage } from '../providers/types';
import { deleteDiagnosis, loadDiagnosis, saveDiagnosis } from '../storage/diagnoses';

export const diagnoses = new Hono<{ Bindings: Env }>();

/** POST /diagnoses — pipeline complet : images -> IA -> Zod -> sécurité -> score. */
diagnoses.post('/', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createDiagnosisRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  const req = parsed.data;

  if (!req.description.trim() && req.imageIds.length === 0) {
    return c.json({ error: 'need_photo_or_description' }, 400);
  }

  // Récupération des images depuis R2.
  const images: DiagnoseImage[] = [];
  if (req.imageIds.length > 0) {
    if (!c.env.IMAGES) return c.json({ error: 'storage_unavailable' }, 503);
    for (const id of req.imageIds) {
      const obj = await c.env.IMAGES.get(`uploads/${id}`);
      if (!obj) return c.json({ error: 'image_not_found', id }, 400);
      images.push({
        contentType: obj.httpMetadata?.contentType ?? 'image/jpeg',
        data: await obj.arrayBuffer(),
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
      const status = err.code === 'ai_request_failed' ? 502 : 422;
      return c.json({ error: err.code, message: err.message }, status);
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

  await saveDiagnosis(c.env, result);
  return c.json({ ...result, aiProvider: provider.name, aiModel: provider.model }, 201);
});

diagnoses.get('/:id', async (c) => {
  const found = await loadDiagnosis(c.env, c.req.param('id'));
  if (!found) return c.json({ error: 'not_found' }, 404);
  return c.json(found);
});

diagnoses.delete('/:id', async (c) => {
  await deleteDiagnosis(c.env, c.req.param('id'));
  return c.body(null, 204);
});
