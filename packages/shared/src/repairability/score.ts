import type { Difficulty, RiskLevel } from '../constants';
import type { Repairability } from '../schemas';

/**
 * RepairabilityScore — DÉTERMINISTE.
 * Combine difficulté, outillage, nb d'étapes, disponibilité des pièces, danger,
 * risque d'aggravation et expérience requise en un score 0..100 + libellé.
 */

export interface RepairabilityInput {
  difficulty: Difficulty;
  toolCount: number;
  stepCount: number;
  partsNeeded: boolean;
  partsAvailability: 'common' | 'uncommon' | 'unknown';
  riskLevel: RiskLevel;
  worseningRisk: 'low' | 'medium' | 'high';
  experienceRequired: 'basic' | 'intermediate' | 'advanced' | 'pro';
  /** Si le classifieur de sécurité impose l'arrêt, le score est plafonné bas. */
  forcedStop?: boolean;
}

const DIFFICULTY_PENALTY: Record<Difficulty, number> = {
  EASY: 0,
  INTERMEDIATE: 12,
  ADVANCED: 28,
  PROFESSIONAL: 55,
};

const RISK_PENALTY: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 8,
  HIGH: 22,
  CRITICAL: 45,
};

const WORSENING_PENALTY = { low: 0, medium: 8, high: 18 } as const;
const EXPERIENCE_PENALTY = { basic: 0, intermediate: 6, advanced: 16, pro: 30 } as const;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function labelForScore(score: number): string {
  if (score >= 75) return 'Easy DIY repair';
  if (score >= 50) return 'Doable with some experience';
  if (score >= 25) return 'Difficult — consider a professional';
  return 'Professional repair recommended';
}

export function computeRepairabilityScore(input: RepairabilityInput): Repairability {
  let score = 100;

  score -= DIFFICULTY_PENALTY[input.difficulty];
  score -= clamp(input.toolCount, 0, 8) * 2.5;
  score -= clamp(input.stepCount - 3, 0, 20) * 1.5;
  score -= RISK_PENALTY[input.riskLevel];
  score -= WORSENING_PENALTY[input.worseningRisk];
  score -= EXPERIENCE_PENALTY[input.experienceRequired];

  if (input.partsNeeded) {
    score -= 8;
    if (input.partsAvailability === 'uncommon') score -= 10;
    if (input.partsAvailability === 'unknown') score -= 6;
  }

  let final = Math.round(clamp(score, 0, 100));
  if (input.forcedStop) final = Math.min(final, 12);

  return { score: final, label: labelForScore(final) };
}
