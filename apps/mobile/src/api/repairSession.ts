import type { RepairCheck, RepairSession, StepVerdict } from '@fixit/shared';
import { apiGet, apiPostJson } from './client';

export type { RepairCheck, RepairSession, StepVerdict };
export { VERDICT_META } from '@/features/repair/verdictMeta';

export interface VerifyStepResult {
  check: RepairCheck;
  session: RepairSession;
}

/** Récupère la session interactive existante, ou `null` si aucune n'a été démarrée. */
export async function getRepairSession(diagnosisId: string): Promise<RepairSession | null> {
  try {
    return await apiGet<RepairSession>(`/diagnoses/${diagnosisId}/repair-session`);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/** Démarre (ou récupère) la session interactive. Nécessite un guide déjà généré. */
export function startRepairSession(diagnosisId: string): Promise<RepairSession> {
  return apiPostJson<RepairSession>(`/diagnoses/${diagnosisId}/repair-session`, {});
}

export function verifyStep(
  diagnosisId: string,
  input: { stepIndex: number; imageId: string; note?: string },
): Promise<VerifyStepResult> {
  return apiPostJson<VerifyStepResult>(`/diagnoses/${diagnosisId}/repair-session/verify`, {
    stepIndex: input.stepIndex,
    imageId: input.imageId,
    note: input.note ?? '',
  });
}
