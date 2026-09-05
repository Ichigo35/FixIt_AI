/**
 * Isolé de `stackClient.ts` (qui importe `@/config` → `expo-constants`, injoignable
 * en environnement de test Node) pour rester testable comme `jwt.ts`.
 */
export class StackAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    /** Statut HTTP d'origine, quand l'erreur vient d'une réponse Stack Auth. */
    public status?: number,
  ) {
    super(message);
    this.name = 'StackAuthError';
  }
}

/**
 * `true` quand l'échec vient réellement d'un refresh token invalide/expiré
 * (déconnexion légitime). `false` pour tout ce qui est transitoire — panne
 * réseau (le `fetch` échoue avant toute réponse HTTP, ex. coupure Wi-Fi/DNS),
 * limite de débit (429) ou panne serveur (5xx) côté Stack Auth. Dans ce cas
 * il ne faut PAS effacer la session locale : un prochain appel réessaiera.
 */
export function isDefinitiveAuthFailure(err: unknown): boolean {
  if (err instanceof StackAuthError) {
    if (err.status === undefined) return false;
    if (err.status === 429 || err.status >= 500) return false;
    return true;
  }
  return false;
}
