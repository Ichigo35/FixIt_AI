import type { RepairGuide } from '@fixit/shared';
import { apiGet } from './client';

export function getRepairGuide(diagnosisId: string): Promise<RepairGuide> {
  return apiGet<RepairGuide>(`/diagnoses/${diagnosisId}/repair-guide`);
}
