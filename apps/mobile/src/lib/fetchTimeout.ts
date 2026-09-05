/**
 * `fetch` n'a pas de délai par défaut : si le réseau reste ouvert sans jamais
 * répondre (coupure silencieuse, blocage sur un domaine précis…), l'appel
 * reste en attente **pour toujours** — reproduit en direct sur device : un
 * rafraîchissement de session bloqué sur `api.stack-auth.com` gelait l'écran
 * indéfiniment (spinner animé, JS non planté, mais aucune réponse possible)
 * malgré le reste de l'app parfaitement joignable. `fetchWithTimeout` annule
 * la requête via `AbortController` passé ce délai, pour qu'un appel bloqué
 * échoue proprement (et de façon retryable) plutôt que de figer l'écran.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
