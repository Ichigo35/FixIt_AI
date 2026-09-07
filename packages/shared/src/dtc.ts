/**
 * Codes de défaut OBD-II (véhicules). Validation de **format** uniquement — légère,
 * partagée mobile + serveur pour un retour immédiat quand l'utilisateur saisit un code.
 * La table `code → description` (~550 Ko) vit dans `./dtcData` et n'est importée que
 * par le serveur (jamais dans le bundle mobile ni le barrel `index.ts`).
 */

/**
 * Format d'un DTC générique SAE : une lettre de système (P/C/B/U), un chiffre 0..3,
 * puis 3 caractères hexadécimaux. Ex. `P0300`, `C0035`, `U0100`.
 */
const DTC_RE = /^[PCBU][0-3][0-9A-F]{3}$/;

/**
 * Normalise une saisie utilisateur en code DTC canonique (majuscules, sans espaces
 * ni tirets), ou `null` si ça ne ressemble pas à un code OBD-II.
 * `"p 0300"` / `"p-0300"` / `"P0300 "` → `"P0300"`.
 */
export function normalizeDtc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/[\s-]+/g, '').toUpperCase();
  return DTC_RE.test(clean) ? clean : null;
}

/** true si la chaîne est un code OBD-II générique bien formé. */
export function isDtcFormat(raw: string | null | undefined): boolean {
  return normalizeDtc(raw) !== null;
}
