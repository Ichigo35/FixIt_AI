import { describe, expect, it } from 'vitest';
import { computeRepairabilityScore, labelForScore } from '../src/repairability/score';

describe('computeRepairabilityScore', () => {
  it('réparation simple -> score élevé', () => {
    const r = computeRepairabilityScore({
      difficulty: 'EASY',
      toolCount: 1,
      stepCount: 3,
      partsNeeded: false,
      partsAvailability: 'common',
      riskLevel: 'LOW',
      worseningRisk: 'low',
      experienceRequired: 'basic',
    });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.label).toBe('Easy DIY repair');
  });

  it('réparation pro dangereuse -> score bas', () => {
    const r = computeRepairabilityScore({
      difficulty: 'PROFESSIONAL',
      toolCount: 8,
      stepCount: 15,
      partsNeeded: true,
      partsAvailability: 'uncommon',
      riskLevel: 'HIGH',
      worseningRisk: 'high',
      experienceRequired: 'pro',
    });
    expect(r.score).toBeLessThan(25);
    expect(r.label).toBe('Professional repair recommended');
  });

  it('forcedStop plafonne le score', () => {
    const r = computeRepairabilityScore({
      difficulty: 'EASY',
      toolCount: 0,
      stepCount: 1,
      partsNeeded: false,
      partsAvailability: 'common',
      riskLevel: 'CRITICAL',
      worseningRisk: 'low',
      experienceRequired: 'basic',
      forcedStop: true,
    });
    expect(r.score).toBeLessThanOrEqual(12);
  });

  it('reste borné 0..100', () => {
    const r = computeRepairabilityScore({
      difficulty: 'PROFESSIONAL',
      toolCount: 50,
      stepCount: 999,
      partsNeeded: true,
      partsAvailability: 'unknown',
      riskLevel: 'CRITICAL',
      worseningRisk: 'high',
      experienceRequired: 'pro',
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('labelForScore couvre les paliers', () => {
    expect(labelForScore(80)).toBe('Easy DIY repair');
    expect(labelForScore(60)).toBe('Doable with some experience');
    expect(labelForScore(30)).toBe('Difficult — consider a professional');
    expect(labelForScore(10)).toBe('Professional repair recommended');
  });
});
