import { getLocales } from 'expo-localization';
import { en } from './en';
import { fr } from './fr';
import { makeTranslator, type Translator } from './translate';

export type { Translator } from './translate';

/** Code langue de l'appareil, `en` par défaut. Les tests n'importent que `./translate`. */
function detectLanguage(): 'en' | 'fr' {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export const language: 'en' | 'fr' = detectLanguage();

/** Traducteur global : langue de l'appareil, repli sur l'anglais puis sur la clé. */
export const t: Translator = makeTranslator(language === 'fr' ? fr : en, en);
