import { describe, expect, it } from 'vitest';
import { isDtcFormat, normalizeDtc } from '../src/dtc';
import { lookupDtc } from '../src/dtcData';

describe('normalizeDtc', () => {
  it('normalise casse, espaces et tirets', () => {
    expect(normalizeDtc('p0300')).toBe('P0300');
    expect(normalizeDtc(' P0300 ')).toBe('P0300');
    expect(normalizeDtc('p-0300')).toBe('P0300');
    expect(normalizeDtc('U 0100')).toBe('U0100');
  });

  it('accepte P/C/B/U + chiffre 0..3 + 3 hexa', () => {
    expect(normalizeDtc('C0035')).toBe('C0035');
    expect(normalizeDtc('B00AF')).toBe('B00AF');
  });

  it('rejette ce qui n’est pas un DTC générique', () => {
    expect(normalizeDtc('F21')).toBeNull(); // code électroménager, pas OBD-II
    expect(normalizeDtc('P4300')).toBeNull(); // 2e caractère hors 0..3
    expect(normalizeDtc('P030')).toBeNull(); // trop court
    expect(normalizeDtc('CE-34878-0')).toBeNull(); // code console
    expect(normalizeDtc('')).toBeNull();
    expect(normalizeDtc(null)).toBeNull();
  });

  it('isDtcFormat', () => {
    expect(isDtcFormat('p0420')).toBe(true);
    expect(isDtcFormat('F21')).toBe(false);
  });
});

describe('lookupDtc', () => {
  it('trouve un code générique connu', () => {
    expect(lookupDtc('P0300')).toEqual({
      code: 'P0300',
      description: expect.stringMatching(/misfire/i),
    });
    expect(lookupDtc('p0420')?.description).toMatch(/catalyst/i);
    expect(lookupDtc('U0100')?.description).toMatch(/lost communication/i);
  });

  it('renvoie null pour un code bien formé mais absent, ou mal formé', () => {
    expect(lookupDtc('P0XYZ' as string)).toBeNull();
    expect(lookupDtc('F21')).toBeNull();
    expect(lookupDtc(null)).toBeNull();
  });
});
