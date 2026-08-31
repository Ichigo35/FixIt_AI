import type { Env } from '../env';
import { GeminiProvider } from './gemini';
import { MockProvider } from './mock';
import type { AIProvider } from './types';

export * from './types';

/**
 * Sélection du provider IA. `gemini` si une clé est présente, sinon `mock`
 * (jamais d'erreur au démarrage — le mock renvoie un diagnostic marqué comme
 * provisoire).
 */
export function getAIProvider(env: Env): AIProvider {
  const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
  if (env.GEMINI_API_KEY) {
    return new GeminiProvider(env.GEMINI_API_KEY, model);
  }
  return new MockProvider();
}
