/**
 * Schéma de sortie structurée pour Gemini (`responseSchema`, sous-ensemble OpenAPI).
 * Doit rester compatible avec `rawDiagnosisSchema` (Zod) de @fixit/shared.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    problem: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    severity: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    difficulty: {
      type: 'STRING',
      enum: ['EASY', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'],
    },
    possibleCauses: { type: 'ARRAY', items: { type: 'STRING' } },
    recommendedAction: { type: 'STRING' },
    needsProfessional: { type: 'BOOLEAN' },
    hazards: { type: 'ARRAY', items: { type: 'STRING' } },
    identifiedModel: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        brand: { type: 'STRING', nullable: true },
        model: { type: 'STRING', nullable: true },
        serialNumber: { type: 'STRING', nullable: true },
        confident: { type: 'BOOLEAN' },
      },
      required: ['confident'],
    },
    estimatedTimeMinutes: { type: 'INTEGER', nullable: true },
    estimatedStepCount: { type: 'INTEGER' },
    estimatedCost: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        min: { type: 'NUMBER' },
        max: { type: 'NUMBER' },
        currency: { type: 'STRING' },
      },
      required: ['min', 'max', 'currency'],
    },
    tools: { type: 'ARRAY', items: { type: 'STRING' } },
    parts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          priceMin: { type: 'NUMBER', nullable: true },
          priceMax: { type: 'NUMBER', nullable: true },
          currency: { type: 'STRING', nullable: true },
          priceKnown: { type: 'BOOLEAN' },
        },
        required: ['name', 'priceKnown'],
      },
    },
    partsAvailability: { type: 'STRING', enum: ['common', 'uncommon', 'unknown'] },
    riskOfWorseningDamage: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    moreInfoNeeded: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'problem',
    'confidence',
    'severity',
    'difficulty',
    'possibleCauses',
    'recommendedAction',
    'needsProfessional',
    'hazards',
    'estimatedStepCount',
    'tools',
    'parts',
    'partsAvailability',
    'riskOfWorseningDamage',
    'moreInfoNeeded',
  ],
} as const;
