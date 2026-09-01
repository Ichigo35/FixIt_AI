import { describe, expect, it } from 'vitest';
import { relativeTime, statusMeta } from '@/features/history/statusMeta';

describe('statusMeta', () => {
  it('renvoie la méta connue', () => {
    expect(statusMeta('fixed')).toMatchObject({ label: 'Fixed', tone: 'success' });
    expect(statusMeta('pro_recommended')).toMatchObject({ tone: 'caution' });
  });

  it('retombe sur "open" pour un statut inconnu', () => {
    expect(statusMeta('???')).toEqual(statusMeta('open'));
  });
});

describe('relativeTime', () => {
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const H = 3_600_000;
  const D = 24 * H;

  it('formats courants', () => {
    expect(relativeTime(ago(2 * H))).toBe('today');
    expect(relativeTime(ago(1.2 * D))).toBe('yesterday');
    expect(relativeTime(ago(3 * D))).toBe('3 days ago');
    expect(relativeTime(ago(10 * D))).toBe('1 weeks ago');
    expect(relativeTime(ago(60 * D))).toBe('2 months ago');
    expect(relativeTime(ago(800 * D))).toBe('2 years ago');
  });
});
