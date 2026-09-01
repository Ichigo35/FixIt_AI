import { describe, expect, it } from 'vitest';
import { STEP_VERDICTS } from '@fixit/shared';
import { VERDICT_META } from '@/features/repair/verdictMeta';

describe('VERDICT_META', () => {
  it('couvre tous les verdicts possibles', () => {
    for (const v of STEP_VERDICTS) {
      expect(VERDICT_META[v]).toBeDefined();
      expect(VERDICT_META[v].label.length).toBeGreaterThan(0);
    }
  });

  it('associe un ton cohérent', () => {
    expect(VERDICT_META.pass.tone).toBe('success');
    expect(VERDICT_META.unsafe.tone).toBe('danger');
  });
});
