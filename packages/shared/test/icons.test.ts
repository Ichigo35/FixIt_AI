import { describe, expect, it } from 'vitest';
import {
  STEP_ICON_IDS,
  stepIconId,
  TOOL_ICON_IDS,
  toolIconId,
} from '../src/icons';

describe('toolIconId', () => {
  it('reconnaît le cas de la capture (FR)', () => {
    expect(toolIconId('Jeu de tournevis de précision pour piano')).toBe('screwdriver');
  });

  it('mappe des outils courants en anglais', () => {
    expect(toolIconId('Phillips screwdriver')).toBe('screwdriver');
    expect(toolIconId('Adjustable wrench')).toBe('wrench');
    expect(toolIconId('Allen key set')).toBe('hex-key');
    expect(toolIconId('Needle-nose pliers')).toBe('pliers');
    expect(toolIconId('Digital multimeter')).toBe('multimeter');
    expect(toolIconId('Claw hammer')).toBe('hammer');
    expect(toolIconId('Utility knife')).toBe('utility-knife');
    expect(toolIconId('Cordless drill')).toBe('drill');
    expect(toolIconId('Work gloves')).toBe('work-gloves');
    expect(toolIconId('Safety glasses')).toBe('safety-glasses');
    expect(toolIconId('Tape measure')).toBe('tape-measure');
    expect(toolIconId('Microfiber cloth')).toBe('cloth');
    expect(toolIconId('WD-40')).toBe('lubricant');
    expect(toolIconId('Putty knife')).toBe('scraper');
    expect(toolIconId('PTFE tape')).toBe('tape');
    expect(toolIconId('Soldering iron')).toBe('soldering-iron');
    expect(toolIconId('Step ladder')).toBe('ladder');
  });

  it('mappe des outils courants en français', () => {
    expect(toolIconId('Clé à molette')).toBe('wrench');
    expect(toolIconId('Clé Allen')).toBe('hex-key');
    expect(toolIconId('Pince multiprise')).toBe('pliers');
    expect(toolIconId('Multimètre')).toBe('multimeter');
    expect(toolIconId('Marteau')).toBe('hammer');
    expect(toolIconId('Cutter')).toBe('utility-knife');
    expect(toolIconId('Perceuse-visseuse')).toBe('drill');
    expect(toolIconId('Gants de travail')).toBe('work-gloves');
    expect(toolIconId('Lunettes de protection')).toBe('safety-glasses');
    expect(toolIconId('Mètre ruban')).toBe('tape-measure');
    expect(toolIconId('Chiffon')).toBe('cloth');
    expect(toolIconId('Dégrippant')).toBe('lubricant');
    expect(toolIconId('Lampe torche')).toBe('flashlight');
    expect(toolIconId('Éponge')).toBe('cloth');
    expect(toolIconId('Aspirateur')).toBe('brush');
  });

  it('retombe sur toolbox quand rien ne correspond', () => {
    expect(toolIconId('')).toBe('toolbox');
    expect(toolIconId('Assortiment de quincaillerie diverse')).toBe('toolbox');
    expect(toolIconId('Patience')).toBe('toolbox');
  });

  it('ne renvoie qu\'un id connu', () => {
    const samples = [
      'screwdriver', 'wrench', 'foo', 'clé plate', 'pince coupante', 'niveau à bulle',
      'papier de verre', 'serre-câble', 'décapeur thermique', 'seau', 'ventouse', 'échelle',
    ];
    for (const s of samples) {
      expect(TOOL_ICON_IDS).toContain(toolIconId(s));
    }
  });
});

describe('stepIconId', () => {
  it('reconnaît le cas de la capture (sécurisation)', () => {
    expect(
      stepIconId({
        title: "Sécurisation du piano et de l'espace de travail",
        instruction:
          'Assurez-vous que le grand couvercle du piano est fermement verrouillé sur sa béquille.',
      }),
    ).toBe('secure');
  });

  it('classe les types d\'étape usuels (EN)', () => {
    expect(stepIconId({ title: 'Unplug the appliance from the mains' })).toBe('unplug');
    expect(stepIconId({ title: 'Shut off the water supply' })).toBe('water-off');
    expect(stepIconId({ title: 'Let it cool for 30 minutes' })).toBe('cool-down');
    expect(stepIconId({ title: 'Remove the back panel' })).toBe('disassemble');
    expect(stepIconId({ title: 'Unscrew the four screws' })).toBe('unscrew');
    expect(stepIconId({ title: 'Inspect the seal for wear' })).toBe('inspect');
    expect(stepIconId({ title: 'Clean the filter' })).toBe('clean');
    expect(stepIconId({ title: 'Replace the worn belt' })).toBe('replace');
    expect(stepIconId({ title: 'Tighten the bolts to spec' })).toBe('tighten');
    expect(stepIconId({ title: 'Lubricate the hinge' })).toBe('lubricate');
    expect(stepIconId({ title: 'Reassemble the housing' })).toBe('reassemble');
    expect(stepIconId({ title: 'Test the repair' })).toBe('test');
  });

  it('classe les types d\'étape usuels (FR)', () => {
    expect(stepIconId({ title: "Débrancher l'appareil" })).toBe('unplug');
    expect(stepIconId({ title: "Couper l'eau au robinet d'arrêt" })).toBe('water-off');
    expect(stepIconId({ title: 'Retirer le capot arrière' })).toBe('disassemble');
    expect(stepIconId({ title: 'Dévisser les vis de fixation' })).toBe('unscrew');
    expect(stepIconId({ title: "Nettoyer le joint" })).toBe('clean');
    expect(stepIconId({ title: 'Remplacer la courroie usée' })).toBe('replace');
    expect(stepIconId({ title: 'Remonter le boîtier' })).toBe('reassemble');
    expect(stepIconId({ title: 'Tester le fonctionnement', instruction: 'Rebrancher et tester.' })).toBe('test');
  });

  it('priorise le titre puis retombe sur generic', () => {
    expect(stepIconId({ title: 'Étape 2', instruction: 'Nettoyer soigneusement la zone.' })).toBe('clean');
    expect(stepIconId({ title: 'Faire une pause', instruction: 'Rien de particulier ici.' })).toBe('generic');
    expect(stepIconId({ title: null, instruction: null })).toBe('generic');
  });

  it('ne renvoie qu\'un id connu', () => {
    const samples = [
      { title: 'x' }, { title: 'power off the breaker' }, { title: 'take a photo of your work' },
      { title: 'measure the voltage across the terminals' },
    ];
    for (const s of samples) {
      expect(STEP_ICON_IDS).toContain(stepIconId(s));
    }
  });
});
