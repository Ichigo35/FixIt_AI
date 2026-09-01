import { describe, expect, it } from 'vitest';
import {
  addItem,
  makeItem,
  markAttempt,
  MAX_ATTEMPTS,
  pruneExhausted,
  removeItem,
  type OutboxItem,
} from '@/lib/outboxQueue';

function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    kind: 'history',
    path: '/diagnoses/a/history',
    body: { outcome: 'fixed' },
    label: 'Feedback',
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...overrides,
  };
}

describe('outbox', () => {
  it('addItem ajoute et dédoublonne sur (path + body)', () => {
    const a = item({ id: '1' });
    const b = item({ id: '2' }); // même path + body que a
    const c = item({ id: '3', body: { outcome: 'pro' } });
    let list: OutboxItem[] = [];
    list = addItem(list, a);
    list = addItem(list, b);
    list = addItem(list, c);
    expect(list.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('removeItem retire par id', () => {
    const list = [item({ id: '1' }), item({ id: '2' })];
    expect(removeItem(list, '1').map((i) => i.id)).toEqual(['2']);
  });

  it('markAttempt incrémente le compteur', () => {
    const list = [item({ id: '1' })];
    expect(markAttempt(list, '1')[0]!.attempts).toBe(1);
  });

  it('pruneExhausted sépare les entrées à bout de tentatives', () => {
    const list = [item({ id: '1', attempts: MAX_ATTEMPTS }), item({ id: '2', attempts: 1 })];
    const { kept, dropped } = pruneExhausted(list);
    expect(kept.map((i) => i.id)).toEqual(['2']);
    expect(dropped.map((i) => i.id)).toEqual(['1']);
  });

  it('makeItem produit un id et attempts=0', () => {
    const made = makeItem({ kind: 'history', path: '/x', body: {}, label: 'L' });
    expect(made.attempts).toBe(0);
    expect(made.id).toMatch(/^ob_/);
  });
});
