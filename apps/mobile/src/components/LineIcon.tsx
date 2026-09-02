import { Image } from 'expo-image';
import type { StepIconId, ToolIconId } from '@fixit/shared';
import { useTheme } from '@/theme';

import toolScrewdriver from '../../assets/icons/tool-screwdriver.svg';
import toolHexKey from '../../assets/icons/tool-hex-key.svg';
import toolWrench from '../../assets/icons/tool-wrench.svg';
import toolPliers from '../../assets/icons/tool-pliers.svg';
import toolHammer from '../../assets/icons/tool-hammer.svg';
import toolUtilityKnife from '../../assets/icons/tool-utility-knife.svg';
import toolScissors from '../../assets/icons/tool-scissors.svg';
import toolSaw from '../../assets/icons/tool-saw.svg';
import toolDrill from '../../assets/icons/tool-drill.svg';
import toolMultimeter from '../../assets/icons/tool-multimeter.svg';
import toolFlashlight from '../../assets/icons/tool-flashlight.svg';
import toolWorkGloves from '../../assets/icons/tool-work-gloves.svg';
import toolSafetyGlasses from '../../assets/icons/tool-safety-glasses.svg';
import toolTapeMeasure from '../../assets/icons/tool-tape-measure.svg';
import toolBrush from '../../assets/icons/tool-brush.svg';
import toolCloth from '../../assets/icons/tool-cloth.svg';
import toolBucket from '../../assets/icons/tool-bucket.svg';
import toolLubricant from '../../assets/icons/tool-lubricant.svg';
import toolScraper from '../../assets/icons/tool-scraper.svg';
import toolTape from '../../assets/icons/tool-tape.svg';
import toolGlue from '../../assets/icons/tool-glue.svg';
import toolSolderingIron from '../../assets/icons/tool-soldering-iron.svg';
import toolLadder from '../../assets/icons/tool-ladder.svg';
import toolPlunger from '../../assets/icons/tool-plunger.svg';
import toolToolbox from '../../assets/icons/tool-toolbox.svg';

import stepSecure from '../../assets/icons/step-secure.svg';
import stepUnplug from '../../assets/icons/step-unplug.svg';
import stepWaterOff from '../../assets/icons/step-water-off.svg';
import stepCoolDown from '../../assets/icons/step-cool-down.svg';
import stepDisassemble from '../../assets/icons/step-disassemble.svg';
import stepUnscrew from '../../assets/icons/step-unscrew.svg';
import stepInspect from '../../assets/icons/step-inspect.svg';
import stepClean from '../../assets/icons/step-clean.svg';
import stepMeasure from '../../assets/icons/step-measure.svg';
import stepReplace from '../../assets/icons/step-replace.svg';
import stepTighten from '../../assets/icons/step-tighten.svg';
import stepLubricate from '../../assets/icons/step-lubricate.svg';
import stepReassemble from '../../assets/icons/step-reassemble.svg';
import stepTest from '../../assets/icons/step-test.svg';
import stepPhoto from '../../assets/icons/step-photo.svg';
import stepGeneric from '../../assets/icons/step-generic.svg';

const TOOL_ASSETS = {
  screwdriver: toolScrewdriver,
  'hex-key': toolHexKey,
  wrench: toolWrench,
  pliers: toolPliers,
  hammer: toolHammer,
  'utility-knife': toolUtilityKnife,
  scissors: toolScissors,
  saw: toolSaw,
  drill: toolDrill,
  multimeter: toolMultimeter,
  flashlight: toolFlashlight,
  'work-gloves': toolWorkGloves,
  'safety-glasses': toolSafetyGlasses,
  'tape-measure': toolTapeMeasure,
  brush: toolBrush,
  cloth: toolCloth,
  bucket: toolBucket,
  lubricant: toolLubricant,
  scraper: toolScraper,
  tape: toolTape,
  glue: toolGlue,
  'soldering-iron': toolSolderingIron,
  ladder: toolLadder,
  plunger: toolPlunger,
  toolbox: toolToolbox,
} satisfies Record<ToolIconId, number>;

const STEP_ASSETS = {
  secure: stepSecure,
  unplug: stepUnplug,
  'water-off': stepWaterOff,
  'cool-down': stepCoolDown,
  disassemble: stepDisassemble,
  unscrew: stepUnscrew,
  inspect: stepInspect,
  clean: stepClean,
  measure: stepMeasure,
  replace: stepReplace,
  tighten: stepTighten,
  lubricate: stepLubricate,
  reassemble: stepReassemble,
  test: stepTest,
  photo: stepPhoto,
  generic: stepGeneric,
} satisfies Record<StepIconId, number>;

interface LineIconProps {
  size?: number;
  /** Couleur du trait ; défaut = texte atténué du thème. */
  color?: string;
}

/** Petite icône au trait (SVG monochrome, teinte via `tintColor`). */
export function ToolIcon({ id, size = 20, color }: LineIconProps & { id: ToolIconId }) {
  const theme = useTheme();
  return (
    <Image
      source={TOOL_ASSETS[id] ?? TOOL_ASSETS.toolbox}
      style={{ width: size, height: size }}
      contentFit="contain"
      tintColor={color ?? theme.colors.textMuted}
      accessibilityIgnoresInvertColors
    />
  );
}

export function StepIcon({ id, size = 22, color }: LineIconProps & { id: StepIconId }) {
  const theme = useTheme();
  return (
    <Image
      source={STEP_ASSETS[id] ?? STEP_ASSETS.generic}
      style={{ width: size, height: size }}
      contentFit="contain"
      tintColor={color ?? theme.colors.primary}
      accessibilityIgnoresInvertColors
    />
  );
}
