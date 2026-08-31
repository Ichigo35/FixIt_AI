import { describe, expect, it } from 'vitest';
import { coerceRawDiagnosis, coerceRepairGuide, rawDiagnosisSchema } from '../src/schemas';

const valid = {
  problem: 'Blocked drain pump filter',
  confidence: 0.82,
  severity: 'LOW',
  difficulty: 'EASY',
  possibleCauses: ['Foreign object in filter', 'Blocked drain hose'],
  recommendedAction: 'Clean the drain filter',
  needsProfessional: false,
  hazards: [],
  tools: ['Towel', 'Shallow tray'],
  parts: [],
  moreInfoNeeded: [],
};

describe('rawDiagnosisSchema', () => {
  it('valide une sortie correcte', () => {
    expect(() => rawDiagnosisSchema.parse(valid)).not.toThrow();
  });

  it('rejette une confidence hors bornes', () => {
    expect(() => rawDiagnosisSchema.parse({ ...valid, confidence: 5 })).toThrow();
  });

  it('rejette une severity inconnue', () => {
    expect(() => rawDiagnosisSchema.parse({ ...valid, severity: 'SEVERE' })).toThrow();
  });

  it('coerceRawDiagnosis normalise confidence en %, severity et difficulty en majuscules', () => {
    const r = coerceRawDiagnosis({ ...valid, confidence: 82, severity: 'low', difficulty: 'easy' });
    expect(r.confidence).toBeCloseTo(0.82);
    expect(r.severity).toBe('LOW');
    expect(r.difficulty).toBe('EASY');
  });

  it('coerceRawDiagnosis applique les valeurs par défaut', () => {
    const r = coerceRawDiagnosis({
      problem: 'x y z',
      confidence: 0.5,
      severity: 'MEDIUM',
      difficulty: 'INTERMEDIATE',
      possibleCauses: ['a'],
      recommendedAction: 'do a',
      needsProfessional: false,
    });
    expect(r.hazards).toEqual([]);
    expect(r.tools).toEqual([]);
    expect(r.moreInfoNeeded).toEqual([]);
    expect(r.partsAvailability).toBe('unknown');
    expect(r.estimatedStepCount).toBe(4);
  });
});

describe('coerceRepairGuide', () => {
  const guide = {
    summary: 'Replace the worn tap cartridge.',
    difficulty: 'intermediate',
    requiredSkill: 'Intermediate',
    estimatedTimeMinutes: 30,
    tools: ['Wrench'],
    parts: [{ name: 'Cartridge', priceKnown: false }],
    steps: [
      { title: 'Shut off water', instruction: 'Close the isolation valves under the sink.' },
      { title: 'Swap cartridge', instruction: 'Remove the retaining nut and replace the cartridge.' },
    ],
  };

  it('normalise la casse et indexe les étapes', () => {
    const r = coerceRepairGuide(guide);
    expect(r.difficulty).toBe('INTERMEDIATE');
    expect(r.requiredSkill).toBe('intermediate');
    expect(r.steps[0]?.index).toBe(0);
    expect(r.steps[1]?.index).toBe(1);
    expect(r.generalWarnings).toEqual([]);
  });

  it('rejette un guide sans étapes', () => {
    expect(() => coerceRepairGuide({ ...guide, steps: [] })).toThrow();
  });
});
