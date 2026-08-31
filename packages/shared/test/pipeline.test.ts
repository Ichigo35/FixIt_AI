import { describe, expect, it } from 'vitest';
import { assessDiagnosis } from '../src/pipeline';
import type { RawDiagnosis } from '../src/schemas';

function raw(overrides: Partial<RawDiagnosis> = {}): RawDiagnosis {
  return {
    problem: 'Worn faucet cartridge causing a drip',
    confidence: 0.78,
    severity: 'LOW',
    difficulty: 'EASY',
    possibleCauses: ['Worn cartridge', 'Loose packing nut'],
    recommendedAction: 'Replace the cartridge',
    needsProfessional: false,
    hazards: [],
    tools: ['Adjustable wrench', 'Screwdriver'],
    parts: [{ name: 'Faucet cartridge', priceKnown: false }],
    partsAvailability: 'common',
    riskOfWorseningDamage: 'low',
    estimatedStepCount: 5,
    estimatedTimeMinutes: 25,
    moreInfoNeeded: [],
    ...overrides,
  };
}

describe('assessDiagnosis', () => {
  it('robinet qui fuit -> DIY, score de réparabilité élevé', () => {
    const { safety, repairability } = assessDiagnosis({
      category: 'plumbing',
      description: 'the kitchen tap keeps dripping',
      diagnosis: raw(),
    });
    expect(safety.forcedStop).toBe(false);
    expect(['DIY', 'CAUTION']).toContain(safety.recommendation);
    expect(repairability.score).toBeGreaterThan(55);
  });

  it('câble électrique endommagé -> STOP + score plafonné', () => {
    const { safety, repairability } = assessDiagnosis({
      category: 'appliance',
      description: 'the mains power cable is damaged, copper is showing',
      diagnosis: raw({ severity: 'MEDIUM', difficulty: 'INTERMEDIATE' }),
    });
    expect(safety.forcedStop).toBe(true);
    expect(safety.recommendation).toBe('PROFESSIONAL');
    expect(repairability.score).toBeLessThanOrEqual(12);
  });

  it('réparation intermédiaire sans danger -> score au milieu de l\'échelle', () => {
    const { safety, repairability } = assessDiagnosis({
      category: 'furniture',
      description: 'the drawer slide is broken and the drawer falls out',
      diagnosis: raw({
        problem: 'Broken drawer slide',
        severity: 'LOW',
        difficulty: 'INTERMEDIATE',
        tools: ['Screwdriver', 'Drill', 'Measuring tape'],
        parts: [{ name: 'Pair of drawer slides', priceKnown: false }],
        partsAvailability: 'common',
        riskOfWorseningDamage: 'medium',
        estimatedStepCount: 8,
      }),
    });
    expect(safety.forcedStop).toBe(false);
    expect(repairability.score).toBeGreaterThan(35);
    expect(repairability.score).toBeLessThan(80);
  });

  it('réparation avancée risquée mais non dangereuse -> score bas, pas de STOP', () => {
    const { safety, repairability } = assessDiagnosis({
      category: 'appliance',
      description: 'washing machine drum bearing is noisy',
      diagnosis: raw({
        problem: 'Worn drum bearing',
        severity: 'MEDIUM',
        difficulty: 'ADVANCED',
        tools: ['Socket set', 'Bearing puller', 'Hammer', 'Screwdriver'],
        parts: [{ name: 'Drum bearing kit', priceKnown: false }],
        partsAvailability: 'uncommon',
        riskOfWorseningDamage: 'high',
        estimatedStepCount: 14,
      }),
    });
    expect(safety.forcedStop).toBe(false);
    expect(repairability.score).toBeLessThan(30);
  });
});
