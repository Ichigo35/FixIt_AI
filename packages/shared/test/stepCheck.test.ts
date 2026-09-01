import { describe, expect, it } from 'vitest';
import { coerceRawStepCheck, rawStepCheckSchema, repairSessionSchema } from '../src/schemas';

describe('coerceRawStepCheck', () => {
  it('valide une sortie correcte', () => {
    const r = coerceRawStepCheck({
      verdict: 'pass',
      summary: 'The screws are fully seated and the panel is flush.',
      advice: [],
    });
    expect(r.verdict).toBe('pass');
    expect(r.escalate).toBe(false);
  });

  it('normalise les alias de verdict', () => {
    expect(coerceRawStepCheck({ verdict: 'LOOKS GOOD', summary: 'ok' }).verdict).toBe('pass');
    expect(coerceRawStepCheck({ verdict: 'needs-work', summary: 'x' }).verdict).toBe('retry');
    expect(coerceRawStepCheck({ verdict: 'Danger', summary: 'x' }).verdict).toBe('unsafe');
    expect(coerceRawStepCheck({ verdict: "can't tell", summary: 'x' }).verdict).toBe('unclear');
  });

  it('force escalate quand le verdict est unsafe', () => {
    const r = coerceRawStepCheck({ verdict: 'unsafe', summary: 'Bare wire visible near the terminal.' });
    expect(r.escalate).toBe(true);
  });

  it('accepte un advice sous forme de chaîne unique', () => {
    const r = coerceRawStepCheck({ verdict: 'retry', summary: 'x', advice: 'Push the clip until it clicks.' });
    expect(r.advice).toEqual(['Push the clip until it clicks.']);
  });

  it('rejette un verdict inconnu', () => {
    expect(() => rawStepCheckSchema.parse({ verdict: 'maybe', summary: 'x' })).toThrow();
  });
});

describe('repairSessionSchema', () => {
  it('valide une session avec des checks', () => {
    const parsed = repairSessionSchema.parse({
      id: 'sess-1',
      diagnosisId: 'diag-1',
      status: 'active',
      currentStep: 1,
      stepCount: 4,
      checks: [
        {
          stepIndex: 0,
          imageId: 'img-1',
          verdict: 'pass',
          summary: 'Power disconnected.',
          advice: [],
          escalate: false,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.checks).toHaveLength(1);
  });
});
