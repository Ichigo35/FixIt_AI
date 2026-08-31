/**
 * Constantes de domaine partagées entre le mobile et l'API.
 * Aucune logique réseau ici — valeurs pures uniquement.
 */

export const CATEGORIES = [
  'appliance',
  'electronics',
  'computer',
  'furniture',
  'plumbing',
  'vehicle',
  'home_installation',
  'tool',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  appliance: 'Appliance',
  electronics: 'Electronics',
  computer: 'Computer',
  furniture: 'Furniture',
  plumbing: 'Plumbing',
  vehicle: 'Vehicle',
  home_installation: 'Home installation',
  tool: 'Tool / machine',
  other: 'Other',
};

/** Niveaux de risque, ordonnés du moins au plus grave. */
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Recommandation finale affichée à l'utilisateur. */
export const RECOMMENDATIONS = ['DIY', 'CAUTION', 'PROFESSIONAL'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const RECOMMENDATION_META: Record<
  Recommendation,
  { emoji: string; title: string; blurb: string }
> = {
  DIY: { emoji: '🟢', title: 'DIY', blurb: 'You can probably fix this' },
  CAUTION: { emoji: '🟡', title: 'CAUTION', blurb: 'Possible DIY with experience' },
  PROFESSIONAL: { emoji: '🔴', title: 'PROFESSIONAL', blurb: "Don't attempt this yourself" },
};

/** Difficulté, ordonnée du plus simple au plus complexe. */
export const DIFFICULTIES = ['EASY', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_META: Record<Difficulty, { emoji: string; label: string }> = {
  EASY: { emoji: '🟢', label: 'Easy' },
  INTERMEDIATE: { emoji: '🟡', label: 'Intermediate' },
  ADVANCED: { emoji: '🟠', label: 'Advanced' },
  PROFESSIONAL: { emoji: '🔴', label: 'Professional' },
};

export const SEVERITIES = RISK_LEVELS;
export type Severity = RiskLevel;

export const DIAGNOSIS_STATUSES = ['open', 'fixed', 'pro_recommended', 'abandoned'] as const;
export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];

export const IMAGE_KINDS = ['problem', 'label', 'before', 'after', 'step'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const FREE_MONTHLY_DIAGNOSES = 3;

/** Ordre utilitaire pour comparer deux niveaux de risque. */
export function riskRank(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}

/** Renvoie le plus grave des deux niveaux de risque. */
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskRank(a) >= riskRank(b) ? a : b;
}

export function recommendationRank(r: Recommendation): number {
  return RECOMMENDATIONS.indexOf(r);
}

/** Renvoie la recommandation la plus prudente des deux (jamais la plus permissive). */
export function stricterRecommendation(a: Recommendation, b: Recommendation): Recommendation {
  return recommendationRank(a) >= recommendationRank(b) ? a : b;
}
