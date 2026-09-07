import type { MoneyRange, RawDiagnosis } from '../schemas';

/**
 * « Vaut-il le coup de réparer ? » — heuristique **pure et déterministe**, dérivée
 * uniquement du diagnostic (coût estimé, score de réparabilité, dispo des pièces,
 * risque d'aggraver) + éventuellement le prix du neuf saisi par l'utilisateur.
 * Aucune requête IA.
 */
export interface RepairVsReplaceInput {
  estimatedCost?: MoneyRange | null;
  repairabilityScore: number;
  partsAvailability: RawDiagnosis['partsAvailability'];
  riskOfWorseningDamage: RawDiagnosis['riskOfWorseningDamage'];
  /** Prix du neuf approximatif, si l'utilisateur l'a renseigné. */
  replacementCost?: number | null;
}

export type RepairVerdict = 'repair' | 'borderline' | 'replace';

export interface RepairVsReplace {
  verdict: RepairVerdict;
  /** coût de réparation médian / prix du neuf, si les deux sont connus. */
  ratio: number | null;
  /** Facteurs qui ont pesé, du plus au moins déterminant (texte affiché tel quel). */
  reasons: string[];
}

function midCost(cost?: MoneyRange | null): number | null {
  if (!cost) return null;
  const m = (cost.min + cost.max) / 2;
  return Number.isFinite(m) && m > 0 ? m : null;
}

/**
 * Score : > 0 penche « réparer », < 0 penche « remplacer ».
 * `repair` à partir de +2, `replace` à partir de -2, sinon `borderline`.
 */
export function repairVsReplace(input: RepairVsReplaceInput): RepairVsReplace {
  const reasons: string[] = [];
  let score = 0;

  const repair = midCost(input.estimatedCost);
  const replacement =
    input.replacementCost && input.replacementCost > 0 ? input.replacementCost : null;
  const ratio = repair != null && replacement != null ? repair / replacement : null;

  if (ratio != null) {
    if (ratio <= 0.25) {
      score += 2;
      reasons.push('Repair costs a small fraction of a new one');
    } else if (ratio <= 0.45) {
      score += 1;
      reasons.push('Repair is clearly cheaper than replacing');
    } else if (ratio >= 0.75) {
      score -= 2;
      reasons.push('Repair costs almost as much as a new one');
    } else if (ratio >= 0.55) {
      score -= 1;
      reasons.push('Repair costs more than half the price of a new one');
    }
  }

  const s = input.repairabilityScore;
  if (s >= 70) {
    score += 2;
    reasons.push('Straightforward repair');
  } else if (s >= 50) {
    score += 1;
  } else if (s < 25) {
    score -= 2;
    reasons.push('Difficult repair with a low chance of success');
  } else if (s < 40) {
    score -= 1;
    reasons.push('Repair is on the harder side');
  }

  if (input.partsAvailability === 'common') {
    score += 1;
  } else if (input.partsAvailability === 'uncommon') {
    score -= 2;
    reasons.push('Replacement parts are hard to find');
  } else {
    reasons.push('Part availability is unknown');
  }

  if (input.riskOfWorseningDamage === 'high') {
    score -= 1;
    reasons.push('Real risk of making the damage worse');
  } else if (input.riskOfWorseningDamage === 'low') {
    score += 1;
  }

  const verdict: RepairVerdict = score >= 2 ? 'repair' : score <= -2 ? 'replace' : 'borderline';
  return { verdict, ratio, reasons };
}
