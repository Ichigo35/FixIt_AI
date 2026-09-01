import { ApiError } from '@/api/ApiError';

/** Contexte d'appel — permet d'adapter le message par écran. */
export type ErrorContext = 'diagnosis' | 'repairGuide' | 'upload' | 'history' | 'list' | 'auth' | 'generic';

const NETWORK_MESSAGE =
  'Network error. Check your connection and that the API is running.';

/** Messages par code d'erreur API, indépendants du contexte. */
const BY_CODE: Record<string, string> = {
  ai_request_failed: 'The AI service is unavailable right now. Please try again in a moment.',
  quota_exceeded:
    "You've used all your free diagnoses this month. Upgrade to Premium for unlimited.",
  need_photo_or_description: 'Add a photo or a description first.',
  guide_unavailable:
    'This problem is not safe to attempt yourself — no guide is available.',
  not_found: 'This item no longer exists.',
  forbidden: "You don't have access to this.",
  payload_too_large: 'That image is too large. Try a smaller photo.',
  unsupported_media_type: 'That file type is not supported. Use a JPEG, PNG or WebP photo.',
  image_not_found: "We couldn't find that photo anymore. Try adding it again.",
  storage_unavailable: 'Photo storage is unavailable right now. Please try again shortly.',
  unauthorized: 'Please sign in again.',
  invalid_token: 'Your session expired. Please sign in again.',
};

/** Retouche par contexte quand le message générique n'est pas assez précis. */
const BY_CONTEXT: Partial<Record<ErrorContext, Record<string, string>>> = {
  repairGuide: {
    not_found: 'This diagnosis no longer exists, so we cannot build a guide.',
  },
  history: {
    generic: 'Could not save. Try again.',
  },
  list: {
    generic: "Couldn't load your repairs. Check your connection and try again.",
  },
};

/**
 * Transforme une erreur inconnue en phrase lisible et rassurante.
 * Pur : testable sans React ni réseau.
 */
export function friendlyError(err: unknown, context: ErrorContext = 'generic'): string {
  if (err instanceof ApiError) {
    const contextual = BY_CONTEXT[context]?.[err.code];
    if (contextual) return contextual;
    const known = BY_CODE[err.code];
    if (known) return known;
    return `Something went wrong (${err.code}).`;
  }
  // Erreur réseau / inattendue.
  const fallback = BY_CONTEXT[context]?.generic;
  return fallback ?? NETWORK_MESSAGE;
}

/** True si réessayer a une chance d'aider (réseau, IA, stockage, 5xx). */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return (
    err.status >= 500 ||
    err.code === 'ai_request_failed' ||
    err.code === 'storage_unavailable'
  );
}
