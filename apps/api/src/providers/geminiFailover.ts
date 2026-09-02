import type { RawDiagnosis, RawStepCheck, RepairGuide } from '@fixit/shared';
import { GeminiProvider } from './gemini';
import {
  AIProviderError,
  type AIProvider,
  type DiagnoseInput,
  type RepairGuideInput,
  type VerifyStepInput,
} from './types';

/** Repos par défaut après un 429 sans `RetryInfo` (les limites/minute de Gemini). */
const DEFAULT_COOLDOWN_MS = 60_000;
/** Borne haute : on re-teste le modèle préféré au moins une fois par heure. */
const MAX_COOLDOWN_MS = 60 * 60_000;

/**
 * État de repos partagé au niveau du module (donc par isolate Worker) : `model → timestamp`
 * avant lequel ce modèle ne doit pas être resollicité. Best-effort, comme le rate
 * limiting Cloudflare — un isolate neuf repart sur le modèle préféré.
 */
const cooldownUntil = new Map<string, number>();

/** Exposé pour les tests : remet l'état de repos à zéro. */
export function _resetGeminiCooldowns(): void {
  cooldownUntil.clear();
}

/**
 * Bascule automatique entre plusieurs modèles Gemini.
 *
 * Le premier modèle de la liste est le **préféré** ; en cas de 429 (quota ou limite
 * de débit), il est mis en repos pour la durée conseillée par Gemini (`RetryInfo`,
 * sinon 60 s) et l'appel bascule sur le modèle suivant. Dès que le repos est écoulé,
 * le modèle préféré redevient prioritaire — la bascule est donc réversible sans
 * intervention.
 */
export class FailoverGeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly models: string[];
  private readonly byModel: Map<string, GeminiProvider>;
  private lastUsedModel: string;

  constructor(apiKey: string, models: string[]) {
    const unique = [...new Set(models.filter((m) => m.trim()))];
    if (unique.length === 0) throw new Error('FailoverGeminiProvider: au moins un modèle requis');
    this.models = unique;
    this.byModel = new Map(unique.map((m) => [m, new GeminiProvider(apiKey, m)]));
    this.lastUsedModel = unique[0]!;
  }

  /** Modèle qui serait effectivement utilisé pour le prochain appel. */
  get model(): string {
    return this.orderedModels()[0] ?? this.models[0]!;
  }

  diagnose(input: DiagnoseInput): Promise<RawDiagnosis> {
    return this.run((p) => p.diagnose(input));
  }

  generateRepairGuide(input: RepairGuideInput): Promise<RepairGuide> {
    return this.run((p) => p.generateRepairGuide(input));
  }

  verifyStep(input: VerifyStepInput): Promise<RawStepCheck> {
    return this.run((p) => p.verifyStep(input));
  }

  /** Modèles triés : préférés/reposés d'abord (ordre de config), en-repos ensuite. */
  private orderedModels(): string[] {
    const now = Date.now();
    const remaining = (m: string) => Math.max(0, (cooldownUntil.get(m) ?? 0) - now);
    return [...this.models].sort(
      (a, b) => remaining(a) - remaining(b) || this.models.indexOf(a) - this.models.indexOf(b),
    );
  }

  private async run<T>(op: (p: GeminiProvider) => Promise<T>): Promise<T> {
    const ordered = this.orderedModels();
    let lastError: AIProviderError | undefined;

    for (let i = 0; i < ordered.length; i++) {
      const model = ordered[i]!;
      try {
        const result = await op(this.byModel.get(model)!);
        cooldownUntil.delete(model); // succès → le modèle est de nouveau sain
        this.lastUsedModel = model;
        return result;
      } catch (err) {
        if (!(err instanceof AIProviderError) || err.code !== 'ai_rate_limited') throw err;
        const wait = Math.min(err.retryAfterMs ?? DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS);
        cooldownUntil.set(model, Date.now() + wait);
        lastError = err;
        const next = ordered[i + 1];
        if (next) {
          console.warn(
            `[gemini] ${model} en limite de quota (repos ~${Math.round(wait / 1000)} s) → bascule sur ${next}`,
          );
        }
      }
    }

    throw (
      lastError ??
      new AIProviderError('ai_rate_limited', 'Tous les modèles Gemini configurés sont en limite de quota.')
    );
  }
}
