import type { Category, RawDiagnosis } from '@fixit/shared';

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

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  diagnose(input: DiagnoseInput): Promise<RawDiagnosis>;
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
