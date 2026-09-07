import { describe, expect, it } from 'vitest';
import { buildUserPrompt } from '../src/providers/prompt';
import type { DiagnoseInput } from '../src/providers/types';

const base: DiagnoseInput = {
  description: 'engine runs rough',
  category: 'vehicle',
  images: [],
};

describe('buildUserPrompt — entrées enrichies (PHASE 12)', () => {
  it('injecte la signification standard du DTC quand elle est fournie', () => {
    const p = buildUserPrompt({
      ...base,
      errorCode: 'P0300',
      errorCodeInfo: 'Random/Multiple Cylinder Misfire Detected',
    });
    expect(p).toMatch(/P0300/);
    expect(p).toMatch(/Random\/Multiple Cylinder Misfire Detected/);
    expect(p).toMatch(/standard OBD-II meaning/i);
  });

  it('passe un code brut sans signification pour un code non-OBD', () => {
    const p = buildUserPrompt({ ...base, category: 'appliance', errorCode: 'F21' });
    expect(p).toMatch(/F21/);
    expect(p).not.toMatch(/standard OBD-II meaning/i);
    expect(p).toMatch(/as entered by the user/i);
  });

  it('inclut les mesures et le numéro de série quand ils sont fournis', () => {
    const p = buildUserPrompt({
      ...base,
      serialNumber: 'SN-42',
      measurements: '12.4 V at rest, 3 bar rail pressure',
    });
    expect(p).toMatch(/SN-42/);
    expect(p).toMatch(/3 bar rail pressure/);
    expect(p).toMatch(/measurements/i);
  });

  it("n'ajoute aucune de ces lignes quand rien n'est fourni", () => {
    const p = buildUserPrompt(base);
    expect(p).not.toMatch(/fault code/i);
    expect(p).not.toMatch(/measurements/i);
    expect(p).not.toMatch(/Serial number/i);
  });
});
