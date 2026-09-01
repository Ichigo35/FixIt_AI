/**
 * Cœur i18n — pur, testable hors Expo (aucun import natif).
 * Clés en notation pointée (`home.title`), interpolation `{name}`.
 */
export type Dict = { [k: string]: string | Dict };

export function lookup(dict: Dict, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Traducteur avec repli sur un dictionnaire secondaire puis sur la clé brute. */
export function makeTranslator(primary: Dict, fallback: Dict): Translator {
  return (key, params) => {
    const raw = lookup(primary, key) ?? lookup(fallback, key) ?? key;
    return interpolate(raw, params);
  };
}
