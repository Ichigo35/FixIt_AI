import type { Category, RawDiagnosis, RawStepCheck, RepairGuide, RepairStep } from '@fixit/shared';

export interface DiagnoseImage {
  contentType: string;
  /** octets bruts de l'image */
  data: ArrayBuffer;
}

export interface DiagnoseVideo {
  contentType: string;
  /** octets bruts de la vidéo (courte, ~15 s) */
  data: ArrayBuffer;
}

export interface DiagnoseInput {
  description: string;
  category?: Category | null;
  brand?: string | null;
  model?: string | null;
  images: DiagnoseImage[];
  videos?: DiagnoseVideo[];
}

export interface RepairGuideInput {
  diagnosis: RawDiagnosis;
  category?: Category | null;
  description?: string;
  brand?: string | null;
  model?: string | null;
  /**
   * Photos du problème (mêmes octets qu'au diagnostic, dans le même ordre).
   * Elles voyagent dans **l'appel de génération du guide déjà existant** : le
   * modèle peut donc poser des repères (`visual.anchors`) sur les vraies photos
   * de l'utilisateur sans consommer une requête de quota supplémentaire.
   */
  images?: DiagnoseImage[];
  /**
   * `true` quand un administrateur force la génération d'un guide alors que la
   * classification de sécurité imposait un STOP. Le guide est produit malgré tout
   * mais avec des avertissements de sécurité renforcés.
   */
  adminOverride?: boolean;
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

export type AIProviderErrorCode =
  | 'ai_unavailable'
  | 'ai_bad_output'
  | 'ai_request_failed'
  /** Quota/limite de débit atteint (HTTP 429) — un autre modèle peut prendre le relais. */
  | 'ai_rate_limited'
  /** Modèle temporairement saturé (HTTP 503 UNAVAILABLE) — idem, un autre modèle peut répondre. */
  | 'ai_overloaded';

export class AIProviderError extends Error {
  /** Délai conseillé avant de réessayer ce modèle (issu du corps `RetryInfo`), en ms. */
  readonly retryAfterMs?: number;

  constructor(
    public code: AIProviderErrorCode,
    message: string,
    opts?: { retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.retryAfterMs = opts?.retryAfterMs;
  }
}
