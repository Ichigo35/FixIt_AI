import { describe, expect, it } from 'vitest';
import { interpolate, lookup, makeTranslator } from '@/i18n/translate';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';

describe('lookup', () => {
  it('résout une clé pointée', () => {
    expect(lookup(en, 'home.myRepairs')).toBe('My Repairs');
  });
  it('renvoie undefined pour une clé absente ou non-chaîne', () => {
    expect(lookup(en, 'home.nope')).toBeUndefined();
    expect(lookup(en, 'home')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('remplace les paramètres', () => {
    expect(interpolate('{left} of {limit}', { left: 2, limit: 3 })).toBe('2 of 3');
  });
  it('laisse les paramètres manquants tels quels', () => {
    expect(interpolate('{a} {b}', { a: 'x' })).toBe('x {b}');
  });
});

describe('makeTranslator', () => {
  const t = makeTranslator(fr, en);
  it('utilise la langue principale', () => {
    expect(t('home.myRepairs')).toBe('Mes réparations');
  });
  it('retombe sur le dictionnaire secondaire', () => {
    const partial = { home: { myRepairs: 'X' } };
    const t2 = makeTranslator(partial, en);
    expect(t2('home.tagline')).toBe(en.home && (en.home as Record<string, string>).tagline);
  });
  it('retombe sur la clé brute si rien ne correspond', () => {
    expect(t('totally.unknown.key')).toBe('totally.unknown.key');
  });
  it('interpole avec les paramètres', () => {
    expect(t('home.quotaLeft', { left: 1, limit: 3 })).toContain('1');
  });
});

describe('parité des catalogues en/fr', () => {
  const flatKeys = (d: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(d).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    );

  it('fr couvre toutes les clés de en', () => {
    expect(flatKeys(fr as Record<string, unknown>).sort()).toEqual(
      flatKeys(en as Record<string, unknown>).sort(),
    );
  });
});
