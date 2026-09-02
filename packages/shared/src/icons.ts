/**
 * Association déterministe « texte → icône » pour le guide de réparation.
 *
 * Le guide est rédigé par l'IA dans la langue de l'utilisateur (FR ou EN le plus
 * souvent). On mappe le nom d'outil libre et le type d'étape sur un petit jeu
 * fini d'icônes au trait, côté client, sans dépendance : ici on ne renvoie que
 * l'identifiant, le rendu (SVG) vit dans l'app mobile.
 */

/** Icônes d'outils disponibles. `toolbox` = repli quand rien ne correspond. */
export const TOOL_ICON_IDS = [
  'screwdriver',
  'hex-key',
  'wrench',
  'pliers',
  'hammer',
  'utility-knife',
  'scissors',
  'saw',
  'drill',
  'multimeter',
  'flashlight',
  'work-gloves',
  'safety-glasses',
  'tape-measure',
  'brush',
  'cloth',
  'bucket',
  'lubricant',
  'scraper',
  'tape',
  'glue',
  'soldering-iron',
  'ladder',
  'plunger',
  'toolbox',
] as const;
export type ToolIconId = (typeof TOOL_ICON_IDS)[number];

/** Icônes de type d'étape. `generic` = repli. */
export const STEP_ICON_IDS = [
  'secure',
  'unplug',
  'water-off',
  'cool-down',
  'disassemble',
  'unscrew',
  'inspect',
  'clean',
  'measure',
  'replace',
  'tighten',
  'lubricate',
  'reassemble',
  'test',
  'photo',
  'generic',
] as const;
export type StepIconId = (typeof STEP_ICON_IDS)[number];

/** Minuscule + suppression des accents + espaces/apostrophes normalisés. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Règles outils — l'ordre compte, du plus spécifique au plus générique.
 * Les mots-clés sont déjà normalisés (sans accent, séparateurs = espaces).
 */
const TOOL_RULES: ReadonlyArray<readonly [ToolIconId, readonly string[]]> = [
  ['hex-key', ['allen', 'hex key', 'hex wrench', 'hex set', 'cle allen', 'cle 6 pans', 'cle six pans', 'cle hexagonale', 'cle btr', 'clef allen']],
  ['multimeter', ['multimeter', 'multimetre', 'ohmmeter', 'ohmmetre', 'voltmeter', 'voltmetre', 'continuity', 'continuite', 'voltage tester', 'voltage detector', 'mains tester', 'test light', 'testeur de tension', 'testeur electrique', 'testeur de continuite', 'tournevis testeur', 'testeur']],
  ['soldering-iron', ['soldering iron', 'soldering', 'solder', 'fer a souder', 'poste a souder', 'etain', 'flux de soudure']],
  ['screwdriver', ['screwdriver', 'tournevis', 'phillips', 'philips', 'pozidriv', 'flat head', 'flathead', 'slotted', 'cruciforme', 'torx', 'clef cruciforme', 'embout de vissage', 'jeu d embouts', 'precision screwdriver', 'jewel', 'horloger']],
  ['wrench', ['wrench', 'spanner', 'pipe wrench', 'cle serre tube', 'cle plate', 'cle mixte', 'cle a fourche', 'cle a pipe', 'cle polygonale', 'cle a douille', 'ratchet', 'cliquet', 'douille', 'socket set', 'socket wrench', 'adjustable wrench', 'cle a molette', 'cle anglaise', 'clef', 'cle de ', 'cle plate']],
  ['pliers', ['pliers', 'plier', 'pince', 'multiprise', 'locking plier', 'vise grip', 'circlip', 'snap ring', 'wire cutter', 'cutting plier', 'diagonal cutter', 'side cutter', 'flush cutter', 'wire stripper', 'strippers', 'pince coupante', 'coupe fil', 'pince a denuder', 'denude', 'tweezers', 'pince a epiler', 'brucelles']],
  ['hammer', ['hammer', 'marteau', 'mallet', 'maillet', 'massette', 'rubber mallet']],
  ['utility-knife', ['utility knife', 'box cutter', 'craft knife', 'stanley knife', 'x acto', 'xacto', 'exacto', 'cutter', 'scalpel', 'razor blade', 'couteau a lame', 'lame de rasoir']],
  ['scissors', ['scissors', 'ciseaux', 'shears', 'snips', 'cisaille']],
  ['saw', ['saw', 'hacksaw', 'scie', 'egoine', 'jigsaw']],
  ['drill', ['drill', 'impact driver', 'perceuse', 'visseuse', 'perceuse visseuse', 'foret', 'drill bit', 'meche', 'hole saw', 'perforateur', 'heat gun', 'decapeur thermique', 'seche cheveux', 'hair dryer']],
  ['flashlight', ['flashlight', 'torch', 'headlamp', 'head torch', 'head lamp', 'work light', 'lampe torche', 'lampe de poche', 'lampe frontale', 'frontale', 'baladeuse', 'lampe']],
  ['work-gloves', ['glove', 'gant', 'nitrile glove', 'cut resistant']],
  ['safety-glasses', ['safety glasses', 'safety goggles', 'goggles', 'eye protection', 'lunettes de protection', 'lunettes de securite', 'protective eyewear', 'dust mask', 'respirator', 'face mask', 'ffp2', 'ffp3', 'n95', 'masque anti poussiere', 'masque de protection']],
  ['tape-measure', ['tape measure', 'measuring tape', 'metre ruban', 'ruban a mesurer', 'ruler', 'straightedge', 'regle', 'reglet', 'double metre', 'metre pliant', 'spirit level', 'bubble level', 'niveau a bulle', 'niveau']],
  ['brush', ['brush', 'paintbrush', 'wire brush', 'bristle', 'brosse', 'pinceau', 'brosse metallique', 'vacuum', 'hoover', 'shop vac', 'aspirateur']],
  ['cloth', ['cloth', 'rag', 'microfiber', 'microfibre', 'lint free', 'chiffon', 'lingette', 'essuie tout', 'torchon', 'tissu', 'sponge', 'eponge', 'scouring pad', 'scrub pad']],
  ['bucket', ['bucket', 'pail', 'basin', 'seau', 'bassine', 'cuvette', 'recipient', 'container', 'bac ']],
  ['lubricant', ['lubricant', 'wd 40', 'wd40', 'penetrating oil', 'silicone spray', 'white lithium', 'grease', 'lubrifiant', 'degrippant', 'graisse', 'huile', 'aerosol', 'spray']],
  ['scraper', ['scraper', 'putty knife', 'paint scraper', 'spatula', 'spatule', 'grattoir', 'racloir', 'couteau a enduire', 'couteau de peintre', 'couteau a mastic', 'sandpaper', 'sand paper', 'sanding', 'abrasive', 'emery', 'papier de verre', 'papier abrasif', 'papier a poncer', 'toile emeri', 'cale a poncer', 'poncage']],
  ['tape', ['electrical tape', 'duct tape', 'masking tape', 'ptfe tape', 'teflon tape', 'insulating tape', 'ruban adhesif', 'adhesif', 'scotch', 'chatterton', 'ruban isolant', 'ruban ptfe', 'ruban de teflon', 'ruban', 'zip tie', 'cable tie', 'serre cable', 'collier de serrage', 'rilsan', 'attache cable', 'colson']],
  ['glue', ['glue', 'adhesive', 'epoxy', 'super glue', 'superglue', 'cyanoacrylate', 'colle', 'araldite', 'loctite', 'sealant', 'mastic', 'silicone sealant', 'frein filet', 'caulk']],
  ['ladder', ['ladder', 'stepladder', 'step ladder', 'step stool', 'echelle', 'escabeau', 'marchepied']],
  ['plunger', ['plunger', 'ventouse', 'deboucheur', 'debouchoir', 'furet']],
];

/** Nom d'outil libre → identifiant d'icône (repli `toolbox`). */
export function toolIconId(name: string): ToolIconId {
  const n = normalize(name);
  if (!n) return 'toolbox';
  for (const [id, keywords] of TOOL_RULES) {
    for (const kw of keywords) {
      if (n.includes(kw.trim())) return id;
    }
  }
  return 'toolbox';
}

/** Types d'étape — l'ordre compte (isolation des énergies d'abord). */
const STEP_RULES: ReadonlyArray<readonly [StepIconId, readonly string[]]> = [
  ['unplug', ['unplug', 'plug out', 'disconnect from mains', 'disconnect the power', 'disconnect the battery', 'pull the plug', 'debrancher', 'debranche', 'cordon d alimentation', 'isoler le secteur', 'coupez le courant', 'coupe le courant', 'disjoncteur', 'circuit breaker', 'power off', 'power down', 'de energise', 'de energize']],
  ['water-off', ['shut off the water', 'turn off the water', 'water supply', 'stopcock', 'shut off valve', 'couper l eau', 'coupez l eau', 'robinet d arret', 'arrivee d eau', 'purger le circuit', 'depressuris', 'gas supply', 'couper le gaz', 'coupez le gaz']],
  ['cool-down', ['let it cool', 'allow it to cool', 'allow to cool', 'cool down', 'laisser refroidir', 'refroidir', 'once cool', 'let the element cool']],
  ['secure', ['make the item safe', 'make it safe', 'mise en securite', 'securiser', 'securisation', 'stabiliser', 'immobiliser', 'immobilisez', 'protective equipment', 'wear gloves', 'wear safety', 'safety first', 'clear the workspace', 'espace de travail', 'ventilate', 'ventiler', 'verrouille', 'verrouiller', 'caler']],
  ['measure', ['measure the voltage', 'test the voltage', 'check continuity', 'check for continuity', 'check the resistance', 'multimeter', 'take a reading', 'mesurer la tension', 'tester la tension', 'verifier la continuite', 'relever la valeur', 'ohms']],
  ['inspect', ['inspect', 'examine', 'check for damage', 'check for wear', 'look for', 'identify the', 'locate the', 'assess the', 'diagnos', 'inspecter', 'examiner', 'reperer', 'reperage', 'reperez', 'verifier l etat', 'observer', 'reperons']],
  ['unscrew', ['unscrew', 'remove the screws', 'undo the screws', 'loosen the screws', 'remove the bolts', 'devisser', 'devissez', 'retirer les vis', 'oter les vis', 'desserrer les vis', 'desserrez les vis', 'retirez les vis']],
  ['reassemble', ['reassemble', 'reattach', 'put it back', 'put everything back', 'refit', 'reinstall', 'close the casing', 'close up', 'remonter', 'remontage', 'remontez', 'remettre en place', 'refermer', 'reposer le capot', 'reposer le panneau']],
  ['replace', ['replace', 'swap the', 'swap in', 'fit the new', 'install the new', 'fit a new', 'renew the', 'remplacer', 'remplacez', 'changer la', 'changer le', 'poser la nouvelle', 'installer la nouvelle', 'monter la piece neuve']],
  ['tighten', ['tighten', 'torque the', 'do up the', 'fasten the', 'secure the bolts', 'serrer', 'resserrer', 'serrez', 'revisser', 'revissez', 'bloquer l ecrou']],
  ['lubricate', ['lubricate', 'apply grease', 'apply a little oil', 'apply oil', 'apply lubricant', 'grease the', 'oil the', 'lubrifier', 'lubrifiez', 'graisser', 'graissez', 'huiler', 'appliquer de la graisse']],
  ['clean', ['clean', 'wipe down', 'wipe away', 'clear the', 'flush out', 'remove debris', 'remove the dust', 'remove dust', 'descale', 'degrease', 'nettoyer', 'nettoyage', 'nettoyez', 'essuyer', 'depoussierer', 'degraisser', 'rincer']],
  ['disassemble', ['disassemble', 'take apart', 'panel', 'cover', 'housing', 'casing', 'enclosure', 'shroud', 'access door', 'open the', 'detach', 'pry off', 'pry open', 'lift off', 'demonter', 'demontage', 'deposer', 'capot', 'panneau', 'couvercle', 'boitier', 'carter', 'ouvrir le', 'degager']],
  ['test', ['test the repair', 'test the appliance', 'power it back on', 'plug it back', 'switch it on', 'turn it back on', 'verify the fix', 'check that it works', 'confirm the problem is', 'final check', 'tester le fonctionnement', 'rebrancher et tester', 'remettre en marche', 'verifier que le probleme', 'controler le bon fonctionnement', 'mise en service']],
  ['photo', ['take a photo', 'photograph the', 'prendre une photo', 'photographier']],
];

/**
 * Type d'étape déduit du titre (prioritaire) puis de l'instruction.
 * Repli : `generic`.
 */
export function stepIconId(step: { title?: string | null; instruction?: string | null }): StepIconId {
  const title = normalize(step.title ?? '');
  const body = normalize(step.instruction ?? '');
  for (const source of [title, body]) {
    if (!source) continue;
    for (const [id, keywords] of STEP_RULES) {
      for (const kw of keywords) {
        if (source.includes(kw.trim())) return id;
      }
    }
  }
  return 'generic';
}
