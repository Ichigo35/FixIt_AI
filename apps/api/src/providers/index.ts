import type { Env } from '../env';
import { FailoverGeminiProvider } from './geminiFailover';
import { MockProvider } from './mock';
import type { AIProvider } from './types';

export * from './types';

/**
 * Sélection du provider IA. `gemini` si une clé est présente, sinon `mock`
 * (jamais d'erreur au démarrage — le mock renvoie un diagnostic marqué comme
 * provisoire).
 *
 * Gemini tourne derrière `FailoverGeminiProvider` : modèle préféré `GEMINI_MODEL`
 * (défaut `gemini-3.6-flash`) puis bascule automatique sur `GEMINI_FALLBACK_MODEL`
 * (défaut `gemini-3.5-flash`) quand le préféré atteint sa limite de quota (429),
 * et retour au préféré dès que son repos est écoulé.
 */
export function getAIProvider(env: Env): AIProvider {
  if (!env.GEMINI_API_KEY) return new MockProvider();
  const primary = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const fallback = (env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash').trim();
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];
  return new FailoverGeminiProvider(env.GEMINI_API_KEY, models);
}
