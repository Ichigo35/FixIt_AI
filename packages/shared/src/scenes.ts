/**
 * Vocabulaire de « scènes » pour illustrer une étape de réparation.
 *
 * Chaque étape est ramenée à une scène (fini, ~23 valeurs). Une scène se décrit
 * par une **composition** — un corps, une cible, un outil, un geste — que le
 * mobile dessine avec des primitives natives (aucune image, aucun réseau, aucun
 * quota IA). L'IA *peut* proposer la scène dans le guide (`step.visual.scene`) ;
 * quand elle ne le fait pas (guides déjà en cache, MockProvider), `sceneForStep`
 * la déduit du texte. Résultat : **toutes** les étapes sont illustrées.
 */

import { normalizeLabel, stepIconId, type StepIconId, type ToolIconId } from './icons';

export const STEP_SCENES = [
  'power-off',
  'water-off',
  'gas-off',
  'cool-down',
  'ppe',
  'unscrew',
  'screw-in',
  'open-panel',
  'pry',
  'disconnect',
  'lift-out',
  'inspect',
  'measure',
  'clean',
  'unclog',
  'lubricate',
  'replace',
  'tighten',
  'reassemble',
  'test',
  'photo',
  'wait',
  'generic',
] as const;
export type StepScene = (typeof STEP_SCENES)[number];

/** Silhouette de fond de la scène. */
export const SCENE_BODIES = ['appliance', 'panel', 'pipe', 'outlet', 'board', 'none'] as const;
export type SceneBody = (typeof SCENE_BODIES)[number];

/** Élément mis en avant : ce que l'utilisateur doit viser. */
export const SCENE_FOCI = [
  'screw',
  'bolt',
  'seam',
  'connector',
  'zone',
  'valve',
  'part',
  'none',
] as const;
export type SceneFocus = (typeof SCENE_FOCI)[number];

/** Geste représenté par la flèche animée. */
export const SCENE_MOTIONS = [
  'ccw',
  'cw',
  'out',
  'in',
  'up',
  'down',
  'sweep',
  'drip',
  'heat',
  'pulse',
  'none',
] as const;
export type SceneMotion = (typeof SCENE_MOTIONS)[number];

export type SceneTone = 'primary' | 'caution' | 'danger' | 'success';

export interface SceneSpec {
  body: SceneBody;
  focus: SceneFocus;
  /** Icône d'outil superposée (jeu d'icônes existant), ou `null`. */
  tool: ToolIconId | null;
  /** Icône de *type d'étape* superposée quand aucun outil ne convient. */
  stepIcon?: StepIconId;
  motion: SceneMotion;
  tone: SceneTone;
}

/** Composition de chaque scène — table pure, lue par le moteur de rendu mobile. */
export const SCENE_SPECS: Record<StepScene, SceneSpec> = {
  'power-off': { body: 'outlet', focus: 'connector', tool: null, motion: 'out', tone: 'danger' },
  'water-off': { body: 'pipe', focus: 'valve', tool: null, motion: 'cw', tone: 'danger' },
  'gas-off': { body: 'pipe', focus: 'valve', tool: 'wrench', motion: 'cw', tone: 'danger' },
  'cool-down': { body: 'appliance', focus: 'zone', tool: null, stepIcon: 'cool-down', motion: 'heat', tone: 'caution' },
  ppe: { body: 'none', focus: 'none', tool: 'work-gloves', motion: 'pulse', tone: 'caution' },
  unscrew: { body: 'panel', focus: 'screw', tool: 'screwdriver', motion: 'ccw', tone: 'primary' },
  'screw-in': { body: 'panel', focus: 'screw', tool: 'screwdriver', motion: 'cw', tone: 'primary' },
  'open-panel': { body: 'appliance', focus: 'seam', tool: null, motion: 'up', tone: 'primary' },
  pry: { body: 'appliance', focus: 'seam', tool: 'scraper', motion: 'out', tone: 'caution' },
  disconnect: { body: 'board', focus: 'connector', tool: null, motion: 'out', tone: 'primary' },
  'lift-out': { body: 'appliance', focus: 'part', tool: null, stepIcon: 'replace', motion: 'up', tone: 'primary' },
  inspect: { body: 'appliance', focus: 'zone', tool: 'flashlight', motion: 'pulse', tone: 'primary' },
  measure: { body: 'board', focus: 'connector', tool: 'multimeter', motion: 'pulse', tone: 'caution' },
  clean: { body: 'appliance', focus: 'zone', tool: 'brush', motion: 'sweep', tone: 'primary' },
  unclog: { body: 'pipe', focus: 'zone', tool: 'plunger', motion: 'down', tone: 'primary' },
  lubricate: { body: 'appliance', focus: 'zone', tool: 'lubricant', motion: 'drip', tone: 'primary' },
  replace: { body: 'appliance', focus: 'part', tool: null, motion: 'in', tone: 'success' },
  tighten: { body: 'panel', focus: 'bolt', tool: 'wrench', motion: 'cw', tone: 'primary' },
  reassemble: { body: 'appliance', focus: 'seam', tool: null, motion: 'down', tone: 'success' },
  test: { body: 'outlet', focus: 'connector', tool: null, motion: 'in', tone: 'success' },
  photo: { body: 'appliance', focus: 'zone', tool: null, stepIcon: 'photo', motion: 'pulse', tone: 'primary' },
  wait: { body: 'appliance', focus: 'zone', tool: null, motion: 'pulse', tone: 'caution' },
  generic: { body: 'appliance', focus: 'zone', tool: 'toolbox', motion: 'none', tone: 'primary' },
};

export function sceneSpec(scene: StepScene): SceneSpec {
  return SCENE_SPECS[scene] ?? SCENE_SPECS.generic;
}

/**
 * Vrai si `keyword` apparaît dans `source` **en début de mot**.
 * Indispensable ici : « devisser » contient « visser », et un simple
 * `includes` classerait un dévissage en revissage.
 */
function startsAtWord(source: string, keyword: string): boolean {
  let from = 0;
  for (;;) {
    const i = source.indexOf(keyword, from);
    if (i < 0) return false;
    if (i === 0 || source[i - 1] === ' ') return true;
    from = i + 1;
  }
}

/**
 * Règles propres aux scènes que le jeu d'icônes ne distingue pas
 * (`pry`, `disconnect`, `lift-out`, `unclog`, `screw-in`, `gas-off`, `wait`).
 * L'ordre compte : du plus spécifique au plus générique.
 */
const SCENE_RULES: ReadonlyArray<readonly [StepScene, readonly string[]]> = [
  ['gas-off', ['gas supply', 'gas valve', 'shut off the gas', 'turn off the gas', 'couper le gaz', 'coupez le gaz', 'vanne de gaz', 'robinet de gaz', 'detendeur']],
  ['disconnect', ['unplug the connector', 'disconnect the connector', 'disconnect the wires', 'disconnect the wiring', 'unclip the connector', 'disconnect the harness', 'unplug the cable from', 'debrancher le connecteur', 'debrancher les fils', 'deconnecter le connecteur', 'deconnecter les fils', 'debrancher la nappe', 'connecteur', 'cosse', 'faisceau', 'wire harness', 'spade terminal', 'terminal block', 'bornier']],
  ['pry', ['pry', 'prise off', 'lever off', 'wedge', 'spudger', 'plastic opening tool', 'faire levier', 'declipser', 'declipsez', 'desolidariser le clip', 'clip', 'languette']],
  ['unclog', ['unclog', 'unblock', 'clear the blockage', 'clear the clog', 'plunger', 'drain the', 'blockage', 'clogged', 'deboucher', 'debouchez', 'bouchon', 'obstruction', 'ventouse', 'furet', 'siphon']],
  ['lift-out', ['lift out', 'lift the', 'remove the filter', 'take out the', 'slide out', 'pull out the', 'extract the', 'extraire', 'retirer le filtre', 'sortir le', 'degager la piece', 'deposer la piece']],
  ['screw-in', ['screw the', 'screw in', 'do up the screws', 'refit the screws', 'put the screws back', 'revisser', 'revissez', 'remettre les vis', 'reposer les vis', 'visser']],
  ['wait', ['wait for', 'leave it for', 'let it sit', 'let it dry', 'leave to dry', 'let it soak', 'attendre', 'attendez', 'laisser agir', 'laisser secher', 'laisser tremper', 'patienter']],
];

/** Repli : type d'icône d'étape -> scène équivalente. */
const SCENE_BY_ICON: Record<StepIconId, StepScene> = {
  secure: 'ppe',
  unplug: 'power-off',
  'water-off': 'water-off',
  'cool-down': 'cool-down',
  disassemble: 'open-panel',
  unscrew: 'unscrew',
  inspect: 'inspect',
  clean: 'clean',
  measure: 'measure',
  replace: 'replace',
  tighten: 'tighten',
  lubricate: 'lubricate',
  reassemble: 'reassemble',
  test: 'test',
  photo: 'photo',
  generic: 'generic',
};

/**
 * Scène déduite du texte de l'étape : règles spécifiques d'abord (titre puis
 * instruction), sinon la scène associée à l'icône d'étape. Jamais d'échec.
 */
export function sceneForStep(step: { title?: string | null; instruction?: string | null }): StepScene {
  const title = normalizeLabel(step.title ?? '');
  const body = normalizeLabel(step.instruction ?? '');
  for (const source of [title, body]) {
    if (!source) continue;
    for (const [scene, keywords] of SCENE_RULES) {
      for (const kw of keywords) {
        if (startsAtWord(source, kw.trim())) return scene;
      }
    }
  }
  return SCENE_BY_ICON[stepIconId(step)] ?? 'generic';
}

/** Normalise une valeur libre (sortie IA) vers une scène connue, sinon `null`. */
export function coerceScene(value: unknown): StepScene | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return (STEP_SCENES as readonly string[]).includes(key) ? (key as StepScene) : null;
}

/**
 * Scène finale d'une étape : celle proposée par l'IA si elle est valide, sinon
 * la déduction textuelle. C'est la seule fonction que l'UI doit appeler.
 */
export function resolveScene(step: {
  title?: string | null;
  instruction?: string | null;
  visual?: { scene?: string | null } | null;
}): StepScene {
  return coerceScene(step.visual?.scene) ?? sceneForStep(step);
}
