import type { Category, RawDiagnosis, RawStepCheck, RepairGuide, RepairStep } from '@fixit/shared';

export interface DiagnoseImage {
  contentType: string;
  /** octets bruts de l'image */
  data: ArrayBuffer;
}

export interface DiagnoseInput {
  description: string;
  category?: Category | null;
  brand?: string | null;
  model?: string | null;
  images: DiagnoseImage[];
}

export interface RepairGuideInput {
  diagnosis: RawDiagnosis;
  category?: Category | null;
  description?: string;
  brand?: string | null;
  model?: string | null;
}

export interface VerifyStepInput {
  step: RepairStep;
  stepNumber: number;
  stepCount: number;
  guideSummary: string;
  diagnosis: RawDiagnosis;
  category?: Category | null;
  note?: string;
  image: DiagnoseImage;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  diagnose(input: DiagnoseInput): Promise<RawDiagnosis>;
  generateRepairGuide(input: RepairGuideInput): Promise<RepairGuide>;
  /** Vérifie une photo de l'utilisateur contre l'étape en cours (réparation interactive). */
  verifyStep(input: VerifyStepInput): Promise<RawStepCheck>;
}

export class AIProviderError extends Error {
  constructor(
    public code: 'ai_unavailable' | 'ai_bad_output' | 'ai_request_failed',
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
