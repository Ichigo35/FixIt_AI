import { STEP_SCENES } from '@fixit/shared';

/** `responseSchema` Gemini pour le guide de réparation. Compatible `repairGuideSchema`. */
export const GEMINI_REPAIR_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    difficulty: {
      type: 'STRING',
      enum: ['EASY', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'],
    },
    estimatedTimeMinutes: { type: 'INTEGER', nullable: true },
    requiredSkill: { type: 'STRING', enum: ['basic', 'intermediate', 'advanced', 'pro'] },
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
    optional: { type: 'ARRAY', items: { type: 'STRING' } },
    generalWarnings: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          title: { type: 'STRING' },
          instruction: { type: 'STRING' },
          safetyWarning: { type: 'STRING', nullable: true },
          tools: { type: 'ARRAY', items: { type: 'STRING' } },
          parts: { type: 'ARRAY', items: { type: 'STRING' } },
          estimatedMinutes: { type: 'INTEGER', nullable: true },
          checks: { type: 'ARRAY', items: { type: 'STRING' } },
          // Plan visuel : produit dans le même appel que le guide (pas de requête en plus).
          visual: {
            type: 'OBJECT',
            properties: {
              scene: { type: 'STRING', enum: [...STEP_SCENES] },
              subject: { type: 'STRING' },
              caption: { type: 'STRING' },
              anchors: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    imageIndex: { type: 'INTEGER' },
                    // [ymin, xmin, ymax, xmax] normalisés 0..1000 (convention Gemini).
                    box: { type: 'ARRAY', items: { type: 'INTEGER' } },
                    label: { type: 'STRING' },
                  },
                  required: ['imageIndex', 'box', 'label'],
                },
              },
            },
            required: ['scene', 'subject', 'caption'],
          },
        },
        required: ['index', 'title', 'instruction', 'visual'],
      },
    },
  },
  required: ['summary', 'difficulty', 'requiredSkill', 'tools', 'parts', 'steps'],
} as const;
