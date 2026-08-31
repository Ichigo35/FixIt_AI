import { describe, expect, it } from 'vitest';
import { coerceRawDiagnosis, rawDiagnosisSchema } from '../src/schemas';

const valid = {
  problem: 'Blocked drain pump filter',
  confidence: 0.82,
  severity: 'LOW',
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

  it('coerceRawDiagnosis normalise confidence en % et severity en minuscules', () => {
    const r = coerceRawDiagnosis({ ...valid, confidence: 82, severity: 'low' });
    expect(r.confidence).toBeCloseTo(0.82);
    expect(r.severity).toBe('LOW');
  });

  it('coerceRawDiagnosis applique les valeurs par défaut', () => {
    const r = coerceRawDiagnosis({
      problem: 'x y z',
      confidence: 0.5,
      severity: 'MEDIUM',
      possibleCauses: ['a'],
      recommendedAction: 'do a',
      needsProfessional: false,
    });
    expect(r.hazards).toEqual([]);
    expect(r.tools).toEqual([]);
    expect(r.moreInfoNeeded).toEqual([]);
  });
});
