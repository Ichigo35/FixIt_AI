/**
 * File d'attente de mutations hors-ligne — logique pure, testable hors Expo.
 * Le provider (`outbox.tsx`) persiste la file et la rejoue à la reconnexion.
 */
export const MAX_ATTEMPTS = 6;

/** Seule mutation prise en charge pour l'instant : l'issue/feedback de réparation. */
export interface OutboxItem {
  id: string;
  kind: 'history';
  /** Chemin API relatif, ex. `/diagnoses/<id>/history`. */
  path: string;
  /** Corps JSON de la requête POST. */
  body: unknown;
  /** Étiquette lisible pour l'UI. */
  label: string;
  createdAt: string;
  attempts: number;
}

export function addItem(list: OutboxItem[], item: OutboxItem): OutboxItem[] {
  // Dédoublonne sur (path + body) : re-cliquer « 👍 » ne crée pas deux entrées.
  const sig = signature(item);
  const withoutDup = list.filter((i) => signature(i) !== sig);
  return [...withoutDup, item];
}

export function removeItem(list: OutboxItem[], id: string): OutboxItem[] {
  return list.filter((i) => i.id !== id);
}

export function markAttempt(list: OutboxItem[], id: string): OutboxItem[] {
  return list.map((i) => (i.id === id ? { ...i, attempts: i.attempts + 1 } : i));
}

/** Retire les entrées qui ont épuisé leurs tentatives (échec durable). */
export function pruneExhausted(list: OutboxItem[]): {
  kept: OutboxItem[];
  dropped: OutboxItem[];
} {
  const kept: OutboxItem[] = [];
  const dropped: OutboxItem[] = [];
  for (const i of list) (i.attempts >= MAX_ATTEMPTS ? dropped : kept).push(i);
  return { kept, dropped };
}

function signature(i: OutboxItem): string {
  return `${i.path}::${JSON.stringify(i.body)}`;
}

export function makeItem(
  input: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>,
  now: () => Date = () => new Date(),
): OutboxItem {
  return {
    ...input,
    id: `ob_${now().getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now().toISOString(),
    attempts: 0,
  };
}
