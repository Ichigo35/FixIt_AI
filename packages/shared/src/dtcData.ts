/**
 * Table `code OBD-II → description` (codes génériques SAE, ~9 400 entrées).
 * **Import serveur uniquement** — volontairement hors du barrel `index.ts` pour ne
 * jamais alourdir le bundle mobile. Voir `./data/LICENSE.md` pour la source et la réserve
 * SAE J2012 (descriptions communautaires, reformulées par le modèle avant affichage).
 */
import { normalizeDtc } from './dtc';
import table from './data/dtc-generic.json';

const DTC: Record<string, string> = table as Record<string, string>;

export interface DtcInfo {
  code: string;
  description: string;
}

/** Cherche la description d'un code OBD-II générique. `null` si inconnu ou mal formé. */
export function lookupDtc(raw: string | null | undefined): DtcInfo | null {
  const code = normalizeDtc(raw);
  if (!code) return null;
  const description = DTC[code];
  return description ? { code, description } : null;
}
