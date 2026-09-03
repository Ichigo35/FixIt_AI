import { describe, expect, it } from 'vitest';
import {
  coerceScene,
  resolveScene,
  sceneForStep,
  sceneSpec,
  SCENE_SPECS,
  STEP_SCENES,
  TOOL_ICON_IDS,
} from '../src';

describe('sceneForStep — déduction depuis le texte', () => {
  it('reconnaît la mise hors tension (FR/EN)', () => {
    expect(sceneForStep({ title: 'Débrancher l’appareil', instruction: '' })).toBe('power-off');
    expect(sceneForStep({ title: 'Unplug the appliance', instruction: '' })).toBe('power-off');
  });

  it('distingue dévisser et revisser', () => {
    expect(sceneForStep({ title: 'Dévisser le panneau arrière', instruction: '' })).toBe('unscrew');
    expect(sceneForStep({ title: 'Remettre les vis en place', instruction: '' })).toBe('screw-in');
  });

  it('reconnaît les scènes propres au vocabulaire de réparation', () => {
    expect(sceneForStep({ title: 'Déboucher le siphon', instruction: '' })).toBe('unclog');
    expect(sceneForStep({ title: 'Déclipser le cache', instruction: '' })).toBe('pry');
    expect(sceneForStep({ title: 'Débrancher le connecteur', instruction: '' })).toBe('disconnect');
    expect(sceneForStep({ title: 'Retirer le filtre', instruction: '' })).toBe('lift-out');
    expect(sceneForStep({ title: 'Laisser sécher 24 h', instruction: '' })).toBe('wait');
    expect(sceneForStep({ title: 'Couper le gaz', instruction: '' })).toBe('gas-off');
  });

  it('retombe sur la scène de l’icône d’étape', () => {
    expect(sceneForStep({ title: 'Nettoyer le filtre', instruction: '' })).toBe('clean');
    expect(sceneForStep({ title: 'Mesurer la tension', instruction: '' })).toBe('measure');
    expect(sceneForStep({ title: 'Remonter le capot', instruction: '' })).toBe('reassemble');
  });

  it('ne renvoie jamais rien d’inconnu', () => {
    expect(STEP_SCENES).toContain(sceneForStep({ title: 'xyzzy', instruction: '' }));
    expect(sceneForStep({ title: '', instruction: '' })).toBe('generic');
    expect(sceneForStep({})).toBe('generic');
  });

  it('lit l’instruction quand le titre ne dit rien', () => {
    expect(
      sceneForStep({ title: 'Étape 2', instruction: 'Dévissez les 4 vis du panneau.' }),
    ).toBe('unscrew');
  });
});

describe('coerceScene', () => {
  it('accepte les variantes de casse et de séparateur', () => {
    expect(coerceScene('POWER_OFF')).toBe('power-off');
    expect(coerceScene(' open panel ')).toBe('open-panel');
  });
  it('rejette ce qui n’est pas une scène connue', () => {
    expect(coerceScene('teleportation')).toBeNull();
    expect(coerceScene(42)).toBeNull();
    expect(coerceScene(undefined)).toBeNull();
  });
});

describe('resolveScene — l’IA propose, le texte tranche', () => {
  it('utilise la scène de l’IA quand elle est valide', () => {
    expect(resolveScene({ title: 'Nettoyer le filtre', visual: { scene: 'inspect' } })).toBe('inspect');
  });
  it('ignore une scène invalide et déduit du texte', () => {
    expect(resolveScene({ title: 'Nettoyer le filtre', visual: { scene: 'nope' } })).toBe('clean');
  });
  it('fonctionne sans plan visuel (guides d’avant la fonctionnalité)', () => {
    expect(resolveScene({ title: 'Débrancher l’appareil' })).toBe('power-off');
  });
});

describe('SCENE_SPECS', () => {
  it('décrit chaque scène', () => {
    for (const scene of STEP_SCENES) {
      const spec = SCENE_SPECS[scene];
      expect(spec).toBeDefined();
      if (spec.tool) expect(TOOL_ICON_IDS).toContain(spec.tool);
    }
  });
  it('sceneSpec retombe sur generic pour une valeur hors table', () => {
    expect(sceneSpec('nope' as never)).toBe(SCENE_SPECS.generic);
  });
});
