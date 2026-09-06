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
/** Clé KV unique où l'état de repos est partagé entre isolates. */
const KV_COOLDOWN_KEY = 'gemini:cooldowns';

/** Sous-ensemble de `KVNamespace` dont on a besoin (facultatif : absent en local/tests). */
export interface CooldownStore {
  get(key: string, type: 'json'): Promise<Record<string, number> | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/**
 * État de repos au niveau du module (donc par isolate Worker) : `model → timestamp`
 * avant lequel ce modèle ne doit pas être resollicité. Sert de cache L1 ; quand un
 * `CooldownStore` (KV) est fourni, il est aussi partagé entre isolates (L2) — sans
 * lui, chaque isolate neuf recrame une requête 429 sur le modèle préféré avant de
 * basculer.
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
 * de débit) ou de 503 (« high demand »), il est mis en repos pour la durée conseillée
 * par Gemini (`RetryInfo`, sinon 60 s / 20 s) et l'appel bascule sur le modèle suivant. Dès que le repos est écoulé,
 * le modèle préféré redevient prioritaire — la bascule est donc réversible sans
 * intervention.
 */
export class FailoverGeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly models: string[];
  private readonly byModel: Map<string, GeminiProvider>;
  private readonly store?: CooldownStore;
  private lastUsedModel: string;

  constructor(apiKey: string, models: string[], store?: CooldownStore) {
    const unique = [...new Set(models.filter((m) => m.trim()))];
    if (unique.length === 0) throw new Error('FailoverGeminiProvider: au moins un modèle requis');
    this.models = unique;
    this.byModel = new Map(unique.map((m) => [m, new GeminiProvider(apiKey, m)]));
    this.store = store;
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

  /** Fusionne l'état de repos partagé (KV) dans le cache module — best-effort. */
  private async loadSharedCooldowns(): Promise<void> {
    if (!this.store) return;
    try {
      const shared = await this.store.get(KV_COOLDOWN_KEY, 'json');
      if (!shared) return;
      const now = Date.now();
      for (const model of this.models) {
        const until = shared[model];
        if (typeof until === 'number' && until > now) {
          cooldownUntil.set(model, Math.max(cooldownUntil.get(model) ?? 0, until));
        }
      }
    } catch {
      /* KV indisponible : on se contente du cache module */
    }
  }

  /** Écrit l'état de repos courant dans le KV partagé — best-effort. */
  private async persistCooldown(): Promise<void> {
    if (!this.store) return;
    const now = Date.now();
    const blob: Record<string, number> = {};
    let maxTtlMs = 0;
    for (const model of this.models) {
      const until = cooldownUntil.get(model) ?? 0;
      if (until > now) {
        blob[model] = until;
        maxTtlMs = Math.max(maxTtlMs, until - now);
      }
    }
    try {
      if (maxTtlMs > 0) {
        await this.store.put(KV_COOLDOWN_KEY, JSON.stringify(blob), {
          expirationTtl: Math.max(60, Math.ceil(maxTtlMs / 1000)),
        });
      }
    } catch {
      /* KV indisponible : le cache module reste la source */
    }
  }

  private async run<T>(op: (p: GeminiProvider) => Promise<T>): Promise<T> {
    await this.loadSharedCooldowns();
    const ordered = this.orderedModels();
    let lastError: AIProviderError | undefined;
    let touchedCooldown = false;

    for (let i = 0; i < ordered.length; i++) {
      const model = ordered[i]!;
      try {
        const result = await op(this.byModel.get(model)!);
        if (cooldownUntil.delete(model)) touchedCooldown = true; // succès → modèle de nouveau sain
        this.lastUsedModel = model;
        if (touchedCooldown) await this.persistCooldown();
        return result;
      } catch (err) {
        const failoverable =
          err instanceof AIProviderError &&
          (err.code === 'ai_rate_limited' || err.code === 'ai_overloaded');
        if (!failoverable) {
          if (touchedCooldown) await this.persistCooldown();
          throw err;
        }
        const wait = Math.min(err.retryAfterMs ?? DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS);
        cooldownUntil.set(model, Date.now() + wait);
        touchedCooldown = true;
        lastError = err;
        const next = ordered[i + 1];
        if (next) {
          const why = err.code === 'ai_overloaded' ? 'saturé' : 'en limite de quota';
          console.warn(
            `[gemini] ${model} ${why} (repos ~${Math.round(wait / 1000)} s) → bascule sur ${next}`,
          );
        }
      }
    }

    if (touchedCooldown) await this.persistCooldown();
    throw (
      lastError ??
      new AIProviderError(
        'ai_rate_limited',
        'Tous les modèles Gemini configurés sont en limite de quota ou saturés.',
      )
    );
  }
}
