import type { Category, DiagnosisResult, RepairOutcome } from '@fixit/shared';
import { apiDelete, apiGet, apiPostJson } from './client';

export type DiagnosisResponse = DiagnosisResult & {
  aiProvider?: string;
  aiModel?: string;
  quota?: { used: number; limit: number };
};

export interface HistoryEntry {
  id: string;
  outcome: RepairOutcome;
  feedbackWorked: boolean | null;
  feedbackNote: string | null;
  summary: string | null;
  beforeR2Key: string | null;
  afterR2Key: string | null;
  createdAt: string;
}

export type DiagnosisDetail = DiagnosisResult & {
  aiProvider: string;
  aiModel: string;
  status: string;
  history: HistoryEntry[];
};

export interface DiagnosisListItem {
  id: string;
  createdAt: string;
  category: string | null;
  problem: string;
  recommendation: string;
  riskLevel: string;
  forcedStop: boolean;
  repairabilityScore: number;
  status: string;
}

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

export async function listDiagnoses(): Promise<DiagnosisListItem[]> {
  const { items } = await apiGet<{ items: DiagnosisListItem[] }>('/diagnoses');
  return items;
}

export function getDiagnosis(id: string): Promise<DiagnosisDetail> {
  return apiGet<DiagnosisDetail>(`/diagnoses/${id}`);
}

export function deleteDiagnosis(id: string): Promise<void> {
  return apiDelete(`/diagnoses/${id}`);
}

export interface SubmitHistoryInput {
  outcome: RepairOutcome;
  feedbackWorked?: boolean | null;
  feedbackNote?: string | null;
  beforeImageId?: string | null;
  afterImageId?: string | null;
}

export function submitHistory(
  id: string,
  input: SubmitHistoryInput,
): Promise<{ ok: true; history: HistoryEntry[] }> {
  return apiPostJson(`/diagnoses/${id}/history`, input);
}
