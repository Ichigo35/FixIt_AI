import { describe, expect, it } from 'vitest';
import { classifySafety } from '../src/safety/classifier';
import type { RawDiagnosis } from '../src/schemas';

function raw(overrides: Partial<RawDiagnosis> = {}): RawDiagnosis {
  return {
    problem: 'Something is wrong',
    confidence: 0.7,
    severity: 'LOW',
    difficulty: 'EASY',
    possibleCauses: ['wear and tear'],
    recommendedAction: 'inspect the part',
    needsProfessional: false,
    hazards: [],
    tools: [],
    parts: [],
    partsAvailability: 'unknown',
    riskOfWorseningDamage: 'low',
    estimatedStepCount: 4,
    moreInfoNeeded: [],
    ...overrides,
  };
}

describe('classifySafety', () => {
  it('laisse passer une réparation bénigne (chaise cassée) en DIY', () => {
    const r = classifySafety({
      category: 'furniture',
      description: 'the chair leg broke off yesterday',
      diagnosis: raw({ problem: 'Broken chair leg joint' }),
    });
    expect(r.riskLevel).toBe('LOW');
    expect(r.recommendation).toBe('DIY');
    expect(r.forcedStop).toBe(false);
  });

  it('robinet qui fuit -> DIY / CAUTION, pas d\'arrêt', () => {
    const r = classifySafety({
      category: 'plumbing',
      description: 'water is dripping from the kitchen faucet base',
      diagnosis: raw({ problem: 'Worn faucet cartridge', severity: 'LOW' }),
    });
    expect(r.forcedStop).toBe(false);
    expect(['DIY', 'CAUTION']).toContain(r.recommendation);
  });

  it('PC qui ne démarre pas -> pas d\'arrêt', () => {
    const r = classifySafety({
      category: 'computer',
      description: "the laptop won't turn on, no lights",
      diagnosis: raw({ problem: 'Possible failed power supply or battery', severity: 'MEDIUM' }),
    });
    expect(r.forcedStop).toBe(false);
    expect(r.recommendation).toBe('CAUTION');
  });

  it('machine à laver bruyante -> CAUTION, pas d\'arrêt', () => {
    const r = classifySafety({
      category: 'appliance',
      description: 'the washing machine makes a loud grinding noise when spinning',
      diagnosis: raw({ problem: 'Worn drum bearing', severity: 'MEDIUM' }),
    });
    expect(r.forcedStop).toBe(false);
    expect(r.recommendation).toBe('CAUTION');
  });

  it('CÂBLE ÉLECTRIQUE ENDOMMAGÉ -> CRITICAL + arrêt forcé + PROFESSIONAL', () => {
    const r = classifySafety({
      category: 'electronics',
      description: 'the power cable is damaged and I can see the bare wire',
      diagnosis: raw({ problem: 'Frayed mains cable', severity: 'MEDIUM' }),
    });
    expect(r.riskLevel).toBe('CRITICAL');
    expect(r.forcedStop).toBe(true);
    expect(r.recommendation).toBe('PROFESSIONAL');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('fuite de gaz -> CRITICAL + arrêt forcé', () => {
    const r = classifySafety({
      category: 'home_installation',
      description: 'I can smell gas near the cooker',
      diagnosis: raw({ severity: 'LOW' }),
    });
    expect(r.riskLevel).toBe('CRITICAL');
    expect(r.forcedStop).toBe(true);
  });

  it('ne peut jamais assouplir la recommandation de l\'IA', () => {
    const r = classifySafety({
      category: 'furniture',
      description: 'small scratch',
      diagnosis: raw({ needsProfessional: true, severity: 'LOW' }),
    });
    expect(r.recommendation).toBe('PROFESSIONAL');
  });

  it('appareil sur secteur sans danger décrit -> PROFESSIONAL mais PAS d\'arrêt forcé', () => {
    const r = classifySafety({
      category: 'appliance',
      description: 'my microwave stopped heating food but the turntable still spins',
      diagnosis: raw({
        problem: 'Likely failed magnetron or high-voltage diode',
        severity: 'HIGH',
        needsProfessional: true,
        hazards: ['mains_electricity', 'high_voltage'],
      }),
    });
    expect(r.forcedStop).toBe(false);
    expect(r.recommendation).toBe('PROFESSIONAL');
    expect(r.riskLevel).toBe('HIGH');
  });

  it('sévérité CRITICAL affirmée par l\'IA -> arrêt forcé', () => {
    const r = classifySafety({
      category: 'electronics',
      description: 'photo of the charger',
      diagnosis: raw({ severity: 'CRITICAL', hazards: ['lithium_battery'] }),
    });
    expect(r.forcedStop).toBe(true);
    expect(r.recommendation).toBe('PROFESSIONAL');
  });

  it('batterie lithium gonflée -> arrêt forcé', () => {
    const r = classifySafety({
      category: 'electronics',
      description: 'the battery is swollen and pushing the case open',
      diagnosis: raw({ severity: 'HIGH' }),
    });
    expect(r.forcedStop).toBe(true);
    expect(r.riskLevel).toBe('CRITICAL');
  });
});
