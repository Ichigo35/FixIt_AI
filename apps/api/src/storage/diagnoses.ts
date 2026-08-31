import { diagnosisResultSchema, type DiagnosisResult } from '@fixit/shared';
import type { Env } from '../env';

/**
 * Persistance provisoire des diagnostics dans R2 (JSON), en attendant Neon (PHASE 6).
 * Permet à `GET /diagnoses/:id` et à l'historique de fonctionner dès maintenant.
 */
function key(id: string): string {
  return `diagnoses/${id}.json`;
}

export async function saveDiagnosis(env: Env, result: DiagnosisResult): Promise<void> {
  if (!env.IMAGES) return;
  await env.IMAGES.put(key(result.id), JSON.stringify(result), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function loadDiagnosis(env: Env, id: string): Promise<DiagnosisResult | null> {
  if (!env.IMAGES) return null;
  const obj = await env.IMAGES.get(key(id));
  if (!obj) return null;
  const parsed = diagnosisResultSchema.safeParse(await obj.json());
  return parsed.success ? parsed.data : null;
}

export async function deleteDiagnosis(env: Env, id: string): Promise<void> {
  if (!env.IMAGES) return;
  await env.IMAGES.delete(key(id));
}
