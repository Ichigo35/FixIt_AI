import type { Category, DiagnosisResult } from '@fixit/shared';
import { apiGet, apiPostJson } from './client';

export type DiagnosisResponse = DiagnosisResult & {
  aiProvider?: string;
  aiModel?: string;
};

export interface CreateDiagnosisInput {
  description?: string;
  category?: Category | null;
  brand?: string | null;
  model?: string | null;
  imageIds?: string[];
}

export function createDiagnosis(input: CreateDiagnosisInput): Promise<DiagnosisResponse> {
  return apiPostJson<DiagnosisResponse>('/diagnoses', {
    description: input.description ?? '',
    category: input.category ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    imageIds: input.imageIds ?? [],
  });
}

export function getDiagnosis(id: string): Promise<DiagnosisResult> {
  return apiGet<DiagnosisResult>(`/diagnoses/${id}`);
}
