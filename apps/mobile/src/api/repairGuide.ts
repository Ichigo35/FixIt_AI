import type { RepairGuide } from '@fixit/shared';
import { apiGet } from './client';

/** `refresh` force la régénération côté serveur (guide sans illustrations). */
export function getRepairGuide(
  diagnosisId: string,
  opts?: { refresh?: boolean },
): Promise<RepairGuide> {
  const query = opts?.refresh ? '?refresh=1' : '';
  return apiGet<RepairGuide>(`/diagnoses/${diagnosisId}/repair-guide${query}`);
}
