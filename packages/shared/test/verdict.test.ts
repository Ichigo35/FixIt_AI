import { describe, expect, it } from 'vitest';
import { repairVsReplace, type RepairVsReplaceInput } from '../src/repairability/verdict';

const base: RepairVsReplaceInput = {
  estimatedCost: null,
  repairabilityScore: 50,
  partsAvailability: 'unknown',
  riskOfWorseningDamage: 'medium',
  replacementCost: null,
};

describe('repairVsReplace', () => {
  it('réparation peu chère + facile + pièces courantes ⇒ repair', () => {
    const r = repairVsReplace({
      ...base,
      estimatedCost: { min: 15, max: 25, currency: 'EUR' },
      replacementCost: 300,
      repairabilityScore: 80,
      partsAvailability: 'common',
      riskOfWorseningDamage: 'low',
    });
    expect(r.verdict).toBe('repair');
    expect(r.ratio).toBeCloseTo(20 / 300);
  });

  it('réparation ≈ prix du neuf + pièces rares ⇒ replace', () => {
    const r = repairVsReplace({
      ...base,
      estimatedCost: { min: 180, max: 220, currency: 'EUR' },
      replacementCost: 250,
      repairabilityScore: 35,
      partsAvailability: 'uncommon',
      riskOfWorseningDamage: 'high',
    });
    expect(r.verdict).toBe('replace');
    expect(r.reasons.join(' ')).toMatch(/hard to find/i);
  });

  it('cas intermédiaire ⇒ borderline', () => {
    const r = repairVsReplace({
      ...base,
      estimatedCost: { min: 120, max: 140, currency: 'EUR' },
      replacementCost: 260,
      repairabilityScore: 55,
      partsAvailability: 'unknown',
      riskOfWorseningDamage: 'medium',
    });
    expect(r.verdict).toBe('borderline');
  });

  it('sans prix du neuf : score très bas ⇒ replace', () => {
    expect(repairVsReplace({ ...base, repairabilityScore: 15 }).verdict).toBe('replace');
    expect(repairVsReplace({ ...base, repairabilityScore: 15 }).ratio).toBeNull();
  });

  it('sans prix du neuf : score élevé + pièces courantes + faible risque ⇒ repair', () => {
    const r = repairVsReplace({
      ...base,
      repairabilityScore: 78,
      partsAvailability: 'common',
      riskOfWorseningDamage: 'low',
    });
    expect(r.verdict).toBe('repair');
  });
});
