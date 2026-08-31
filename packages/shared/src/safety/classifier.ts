import type { Category } from '../constants';
import { maxRisk, stricterRecommendation, type Recommendation, type RiskLevel } from '../constants';
import type { RawDiagnosis, SafetyResult } from '../schemas';

/**
 * SafetyClassifier — DÉTERMINISTE et INDÉPENDANT du texte généré par l'IA.
 *
 * Règle d'or : ce classifieur ne peut que DURCIR la recommandation issue de l'IA,
 * jamais l'assouplir. Il tourne côté serveur et fait autorité.
 *
 * Deux niveaux :
 *  - `forcedStop` (écran « STOP — contact a professional », aucun guide) : réservé aux
 *    dangers RÉELLEMENT décrits (câble secteur endommagé, fil dénudé sous tension,
 *    étincelles, fuite de gaz, condensateur haute tension, batterie lithium gonflée,
 *    feu actif, élément structurel) — ou à une sévérité CRITICAL affirmée par l'IA.
 *  - simple élévation du risque / recommandation « PROFESSIONAL » avec diagnostic visible :
 *    pour les appareils sur secteur, l'électronique interne, la pression, etc.
 */

interface TextRule {
  id: string;
  patterns: RegExp;
  level: RiskLevel;
  forcedStop: boolean;
  reason: string;
}

/** Dangers réellement observés dans la description / le problème. */
const TEXT_RULES: TextRule[] = [
  {
    id: 'bare_live_wire',
    patterns:
      /\b(live wire|fil sous tension|exposed wire|fil dénudé|bare wire|exposed conductor|conducteur (à nu|dénudé)|arcing|électrocut|electrocut|electric shock when|got a shock|sparking (outlet|socket|wire|plug)|prise qui fait des étincelles)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Exposed live wiring / arcing hazard',
  },
  {
    id: 'damaged_power_cable',
    patterns:
      /\b((power |mains )?(cable|cord|wire|lead|flex)[^.]{0,24}\b(damaged|frayed|cut|slashed|burnt|burned|melted|nicked|exposed|chewed|split))\b|\b((damaged|frayed|cut|burnt|burned|melted|nicked|exposed|chewed|split)[^.]{0,24}\b(power |mains )?(cable|cord|wire|lead|flex))\b|\bcâble (électrique )?(endommagé|abîmé|dénudé|coupé|sectionné)\b|\bmelted plug\b|\bprise fondue\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Damaged mains power cable — risk of shock or fire',
  },
  {
    id: 'gas',
    patterns:
      /\b(gas leak|leak(ing|s)? gas|smell(ing|s|ed)?( of)? gas|odeur de gaz|fuite de gaz|natural gas leak|propane leak|gas (line|valve|pipe|main) (leak|damaged|broken)|gazini[èe]re qui fuit|carbon monoxide|monoxyde de carbone|co detector going off)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Gas or carbon-monoxide hazard',
  },
  {
    id: 'high_voltage',
    patterns:
      /\b(high voltage|haute tension|charged capacitor|condensateur (chargé|haute tension)|CRT|tube cathodique|microwave (transformer|capacitor)|flyback transformer)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Stored high-voltage energy hazard (capacitor / HV component)',
  },
  {
    id: 'lithium_battery',
    patterns:
      /\b((swollen|puffed|puffy|bloated|expanding|leaking|smoking|hissing|hot to the touch)[^.]{0,24}\bbatter)\b|\b(batter[^.]{0,24}\b(swollen|puffed|puffy|bloated|expanding|gonflée|leaking|smoking|on fire|hissing))\b|\blithium[^.]{0,24}(damaged|punctured|burning|swollen)\b|\bthermal runaway\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Damaged / swollen lithium battery — fire and toxic-gas risk',
  },
  {
    id: 'fire',
    patterns:
      /\b(on fire|caught fire|flames|actively burning|départ de feu|ça a pris feu|smoke pouring|smoke coming out)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Active fire / smoke',
  },
  {
    id: 'structural',
    patterns:
      /\b(load-?bearing (wall|beam)|mur porteur|structural (crack|damage|failure)|sagging (roof|floor|ceiling)|foundation (crack|movement)|fissure structurelle|poutre fissurée)\b/i,
    level: 'CRITICAL',
    forcedStop: true,
    reason: 'Possible structural / load-bearing failure',
  },

  // --- Dangers sérieux, mais on montre quand même le diagnostic ---
  {
    id: 'pressure_vessel',
    patterns:
      /\b(pressuri[sz]ed|under pressure|sous pression|gas boiler|water heater (leaking|valve)|chauffe-eau|pressure relief valve|refrigerant|fluide frigorigène|compressed gas cylinder|bonbonne sous pression)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Pressurised system — specialised handling required',
  },
  {
    id: 'vehicle_safety_critical',
    patterns:
      /\b(brake(s| pad| line| fluid| caliper)|frein|steering rack|power steering|airbag|fuel line|conduite de carburant|suspension (arm|spring)|wheel bearing|tie rod|ball joint|rotule)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Safety-critical vehicle system',
  },
  {
    id: 'chemical',
    patterns:
      /\b(sulfuric acid|battery acid|corrosive (chemical|liquid)|produit corrosif|strong ammonia|mixed bleach|dégagement de chlore)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Hazardous chemical exposure risk',
  },
  {
    id: 'spring_tension',
    patterns:
      /\b(garage door (spring|torsion)|ressort de porte de garage|torsion spring|spring under (high )?tension|recoil spring)\b/i,
    level: 'HIGH',
    forcedStop: false,
    reason: 'Stored mechanical energy (spring under tension)',
  },
];

/**
 * Plancher de risque par token de danger renvoyé par l'IA.
 * Un token seul n'entraîne JAMAIS un `forcedStop` : « appareil sur secteur » n'est
 * pas « fil dénudé ». Le vrai danger passe par les règles de texte ou la sévérité IA.
 */
const HAZARD_TOKEN_FLOOR: Record<string, RiskLevel> = {
  mains_electricity: 'MEDIUM',
  mains: 'MEDIUM',
  electricity: 'MEDIUM',
  electrical: 'MEDIUM',
  electric_shock: 'HIGH',
  shock: 'HIGH',
  high_voltage: 'HIGH',
  capacitor: 'HIGH',
  gas: 'HIGH',
  carbon_monoxide: 'HIGH',
  co: 'HIGH',
  lithium_battery: 'HIGH',
  battery: 'MEDIUM',
  fire: 'HIGH',
  burn: 'MEDIUM',
  burns: 'MEDIUM',
  hot_surface: 'LOW',
  pressure: 'HIGH',
  pressurized: 'HIGH',
  refrigerant: 'HIGH',
  structural: 'HIGH',
  asbestos: 'HIGH',
  chemical: 'HIGH',
  sharp_edges: 'LOW',
  sharp: 'LOW',
  water: 'LOW',
  water_damage: 'LOW',
  slip: 'LOW',
};

/** Catégories où une vigilance minimale s'impose. */
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

  // Texte « observé » : description utilisateur + raisonnement IA (PAS les tokens de danger).
  const text = [description, diagnosis.problem, diagnosis.recommendedAction, ...diagnosis.possibleCauses]
    .join(' \n ')
    .toLowerCase();

  const reasons: string[] = [];
  let keywordRisk: RiskLevel = 'LOW';
  let forcedStop = false;

  for (const rule of TEXT_RULES) {
    if (rule.patterns.test(text)) {
      keywordRisk = maxRisk(keywordRisk, rule.level);
      if (rule.forcedStop) forcedStop = true;
      reasons.push(rule.reason);
    }
  }

  // Tokens de danger de l'IA : plancher de risque seulement.
  let tokenRisk: RiskLevel = 'LOW';
  for (const token of diagnosis.hazards) {
    const floor = HAZARD_TOKEN_FLOOR[token.toLowerCase().replace(/[\s-]+/g, '_')];
    if (floor) tokenRisk = maxRisk(tokenRisk, floor);
  }

  if (category && ELEVATED_CATEGORIES.includes(category)) {
    keywordRisk = maxRisk(keywordRisk, 'MEDIUM');
  }

  // L'IA affirme un danger critique -> on l'écoute (arrêt).
  if (diagnosis.severity === 'CRITICAL') {
    forcedStop = true;
    if (reasons.length === 0) reasons.push('The AI rated this problem as critical');
  }

  const riskLevel = maxRisk(maxRisk(diagnosis.severity, keywordRisk), tokenRisk);

  let recommendation = stricterRecommendation(
    aiRecommendation(diagnosis),
    severityToRecommendation(riskLevel),
  );
  if (forcedStop) recommendation = 'PROFESSIONAL';

  if (diagnosis.needsProfessional && reasons.length === 0) {
    reasons.push('The AI flagged this as needing a professional');
  }
  if (reasons.length === 0 && recommendation === 'PROFESSIONAL') {
    reasons.push('Severity of the diagnosed problem');
  }

  return { riskLevel, recommendation, forcedStop, reasons };
}
