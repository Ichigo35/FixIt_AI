import { describe, expect, it } from 'vitest';
import { formatClock, isUsableClip } from '@/features/capture/audioMeta';

describe('formatClock', () => {
  it('formate en m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('plafonne à maxSeconds', () => {
    expect(formatClock(45, 30)).toBe('0:30');
    expect(formatClock(20, 30)).toBe('0:20');
  });

  it('tolère les entrées invalides', () => {
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-4)).toBe('0:00');
  });
});

describe('isUsableClip', () => {
  it('exige au moins ~2 s', () => {
    expect(isUsableClip(0)).toBe(false);
    expect(isUsableClip(1.4)).toBe(false);
    expect(isUsableClip(2)).toBe(true);
    expect(isUsableClip(12)).toBe(true);
    expect(isUsableClip(Number.NaN)).toBe(false);
  });
});
