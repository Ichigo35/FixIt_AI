import type { Category } from '../constants';
import { maxRisk, stricterRecommendation, type Recommendation, type RiskLevel } from '../constants';
import type { RawDiagnosis, SafetyResult } from '../schemas';

/**
 * SafetyClassifier — DÉTERMINISTE et INDÉPENDANT du texte généré par l'IA.
 *
 * Règle d'or : ce classifieur ne peut que DURCIR la recommandation issue de l'IA,
 * jamais l'assouplir. Il tourne côté serveur et fait autorité.
 */

type HazardRule = {
  /** token de danger normalisé */
  id: string;
  /** motifs (insensibles à la casse) détectés dans le texte utilisateur + le diagnostic */
  patterns: RegExp;
  level: RiskLevel;
  /** true => arrêt immédiat, aucun guide de réparation n'est fourni */
  forcedStop: boolean;
  reason: string;
};

const RULES: HazardRule[] = [
  {
    id: 'mains_electricity',
    patterns:
      /\b(mains|secteur|230\s?v|240\s?v|120\s?v|110\s?v|live wire|fil sous tension|exposed wire|fil dénudé|bare wire|electrocut|electric shock|court-?circuit|short circuit|sparking outlet|prise qui|tableau électrique|breaker panel|fuse box|consumer unit)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Mains-voltage electrical hazard detected',
  },
  {
    id: 'damaged_power_cable',
    patterns:
      /\b((power |mains )?(cable|cord|wire|lead)[^.]{0,24}\b(damaged|frayed|cut|burnt|burned|melted|nicked|exposed)|(damaged|frayed|cut|burnt|burned|melted|nicked|exposed)[^.]{0,24}\b(power |mains )?(cable|cord|wire|lead)|câble (électrique )?(endommagé|abîmé|dénudé|coupé)|melted plug|prise fondue|exposed conductor)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Damaged mains power cable — risk of shock or fire',
  },
  {
    id: 'gas',
    patterns:
      /\b(gas leak|leak(ing|s)? gas|smell(ing|s|ed)?( of)? gas|odeur de gaz|fuite de gaz|natural gas|propane|butane|lpg|gas (line|valve|pipe|main|smell|hose)|gazini[èe]re qui fuit|carbon monoxide|monoxyde de carbone)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Gas or carbon-monoxide hazard detected',
  },
  {
    id: 'high_voltage',
    patterns:
      /\b(high voltage|haute tension|capacitor|condensateur (haute|de puissance)|CRT|microwave transformer|flyback|stun|tube cathodique)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Stored high-voltage energy hazard (capacitor / HV component)',
  },
  {
    id: 'lithium_battery',
    patterns:
      /\b((swollen|puffed|puffy|bloated|expanding|leaking|smoking)[^.]{0,24}\bbatter|batter[^.]{0,24}\b(swollen|puffed|puffy|bloated|expanding|gonflée|leaking|smoking|on fire)|lithium[^.]{0,24}(damaged|punctured|burning)|thermal runaway)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Damaged / swollen lithium battery — fire and toxic-gas risk',
  },
  {
    id: 'fire',
    patterns: /\b(on fire|flames|burning smell|smoke coming|ça brûle|départ de feu|électrique qui fume)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Active fire / smoke reported',
  },
  {
    id: 'pressure_vessel',
    patterns:
      /\b(pressuri[sz]ed|under pressure|sous pression|boiler|water heater|chauffe-eau|pressure vessel|refrigerant|fluide frigorigène|compressed gas cylinder|bonbonne)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Pressurised system — specialised handling required',
  },
  {
    id: 'structural',
    patterns:
      /\b(load-?bearing|mur porteur|structural (crack|damage)|poutre|joist|roof truss|foundation crack|fissure structurelle)\b/i,
    level: 'HIGH',
    forcedStop: true,
    reason: 'Possible structural / load-bearing element',
  },
  {
    id: 'vehicle_safety_critical',
    patterns:
      /\b(brake|frein|steering|direction assistée|airbag|fuel line|conduite de carburant|suspension arm|triangle de suspension|wheel bearing|tie rod|rotule)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Safety-critical vehicle system',
  },
  {
    id: 'chemical',
    patterns: /\b(acid|sulfuric|corrosive chemical|produit corrosif|ammonia|bleach mix|chlore)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Hazardous chemical exposure risk',
  },
  {
    id: 'spring_tension',
    patterns: /\b(garage door spring|ressort de porte de garage|torsion spring|spring under tension)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Stored mechanical energy (spring under tension)',
  },
];

/** Catégories où l'électricité interne / secteur est courante -> plancher de vigilance. */
const ELEVATED_CATEGORIES: Category[] = ['appliance', 'home_installation', 'vehicle'];

function severityToRecommendation(level: RiskLevel): Recommendation {
  switch (level) {
    case 'CRITICAL':
    case 'HIGH':
      return 'PROFESSIONAL';
    case 'MEDIUM':
      return 'CAUTION';
    default:
      return 'DIY';
  }
}

/** Recommandation « telle qu'exprimée par l'IA », qui sert de base à ne pas assouplir. */
function aiRecommendation(raw: RawDiagnosis): Recommendation {
  if (raw.needsProfessional) return 'PROFESSIONAL';
  return severityToRecommendation(raw.severity);
}

export interface SafetyInput {
  category?: Category | null;
  description?: string;
  diagnosis: RawDiagnosis;
}

export function classifySafety(input: SafetyInput): SafetyResult {
  const { category, description = '', diagnosis } = input;

  const haystack = [
    description,
    diagnosis.problem,
    diagnosis.recommendedAction,
    ...diagnosis.possibleCauses,
    ...diagnosis.hazards,
    ...diagnosis.hazards.map((h) => h.replace(/_/g, ' ')),
  ]
    .join(' \n ')
    .toLowerCase();

  const reasons: string[] = [];
  let keywordRisk: RiskLevel = 'LOW';
  let forcedStop = false;

  for (const rule of RULES) {
    if (rule.patterns.test(haystack)) {
      keywordRisk = maxRisk(keywordRisk, rule.level);
      if (rule.forcedStop) forcedStop = true;
      reasons.push(rule.reason);
    }
  }

  // Plancher lié à la catégorie.
  if (category && ELEVATED_CATEGORIES.includes(category)) {
    keywordRisk = maxRisk(keywordRisk, 'MEDIUM');
  }

  // Combinaison : on prend le plus grave entre la sévérité IA et les mots-clés.
  const riskLevel = maxRisk(diagnosis.severity, keywordRisk);

  // Recommandation : on ne descend jamais sous celle de l'IA.
  let recommendation = stricterRecommendation(
    aiRecommendation(diagnosis),
    severityToRecommendation(riskLevel),
  );

  if (forcedStop) recommendation = 'PROFESSIONAL';
  if (riskLevel === 'CRITICAL') {
    recommendation = 'PROFESSIONAL';
    forcedStop = true;
  }

  if (diagnosis.needsProfessional && reasons.length === 0) {
    reasons.push('The AI flagged this as needing a professional');
  }
  if (reasons.length === 0 && recommendation === 'PROFESSIONAL') {
    reasons.push('Severity of the diagnosed problem');
  }

  return { riskLevel, recommendation, forcedStop, reasons };
}
