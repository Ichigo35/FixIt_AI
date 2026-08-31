import type { Category } from './constants';
import { computeRepairabilityScore } from './repairability/score';
import { classifySafety } from './safety/classifier';
import { skillForDifficulty, type RawDiagnosis, type Repairability, type SafetyResult } from './schemas';

export interface AssessInput {
  diagnosis: RawDiagnosis;
  category?: Category | null;
  description?: string;
}

export interface Assessment {
  safety: SafetyResult;
  repairability: Repairability;
}

/**
 * Assemble le verdict final à partir d'un `RawDiagnosis` (déjà validé) :
 * classification de sécurité déterministe + score de réparabilité.
 * Utilisé côté serveur ; pur et testable.
 */
export function assessDiagnosis(input: AssessInput): Assessment {
  const safety = classifySafety({
    category: input.category,
    description: input.description,
    diagnosis: input.diagnosis,
  });

  const repairability = computeRepairabilityScore({
    difficulty: input.diagnosis.difficulty,
    toolCount: input.diagnosis.tools.length,
    stepCount: input.diagnosis.estimatedStepCount,
    partsNeeded: input.diagnosis.parts.length > 0,
    partsAvailability: input.diagnosis.partsAvailability,
    riskLevel: safety.riskLevel,
    worseningRisk: input.diagnosis.riskOfWorseningDamage,
    experienceRequired: skillForDifficulty(input.diagnosis.difficulty),
    forcedStop: safety.forcedStop,
  });

  return { safety, repairability };
}
