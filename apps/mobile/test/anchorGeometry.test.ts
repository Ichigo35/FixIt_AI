import { describe, expect, it } from 'vitest';
import { anchorRect, labelBelow, pickAnchor } from '@/features/repair/illustration/geometry';

describe('anchorRect', () => {
  it('convertit une boîte 0..1000 en pourcentages', () => {
    expect(anchorRect([100, 200, 500, 600])).toEqual({ left: 20, top: 10, width: 40, height: 40 });
  });

  it('remet dans l’ordre une boîte inversée', () => {
    expect(anchorRect([500, 600, 100, 200])).toEqual({ left: 20, top: 10, width: 40, height: 40 });
  });

  it('borne les coordonnées hors cadre', () => {
    const r = anchorRect([-200, 0, 1400, 1200]);
    expect(r.top).toBe(0);
    expect(r.left).toBe(0);
    expect(r.top + r.height).toBeLessThanOrEqual(100);
    expect(r.left + r.width).toBeLessThanOrEqual(100);
  });

  it('élargit un repère trop petit autour de son centre', () => {
    const r = anchorRect([500, 500, 505, 505]);
    expect(r.width).toBe(4);
    expect(r.height).toBe(4);
    expect(r.left + r.width / 2).toBeCloseTo(50.25, 5);
  });

  it('garde un repère minuscule au bord dans le cadre', () => {
    const r = anchorRect([0, 0, 2, 2]);
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
    expect(r.width).toBe(4);
  });
});

describe('pickAnchor', () => {
  const anchor = (imageIndex: number) => ({
    imageIndex,
    box: [0, 0, 100, 100] as [number, number, number, number],
    label: 'x',
  });

  it('renvoie le premier repère pointant une photo disponible', () => {
    expect(pickAnchor([anchor(3), anchor(1)], 2)?.imageIndex).toBe(1);
  });
  it('renvoie null sans repère ou sans photo', () => {
    expect(pickAnchor([], 2)).toBeNull();
    expect(pickAnchor(undefined, 2)).toBeNull();
    expect(pickAnchor([anchor(0)], 0)).toBeNull();
  });
});

describe('labelBelow', () => {
  it('bascule le libellé sous la boîte quand elle touche le haut', () => {
    expect(labelBelow({ left: 0, top: 4, width: 10, height: 10 })).toBe(true);
    expect(labelBelow({ left: 0, top: 40, width: 10, height: 10 })).toBe(false);
  });
});
