import type { StepVerdict } from '@fixit/shared';

/** Présentation d'un verdict de vérification d'étape (module pur, testable hors Expo). */
export const VERDICT_META: Record<
  StepVerdict,
  { emoji: string; label: string; tone: 'success' | 'caution' | 'danger' | 'muted' }
> = {
  pass: { emoji: '✅', label: 'Looks good', tone: 'success' },
  retry: { emoji: '🔁', label: 'Needs another go', tone: 'caution' },
  unsafe: { emoji: '🛑', label: 'Stop — hazard spotted', tone: 'danger' },
  unclear: { emoji: '❓', label: 'Photo unclear', tone: 'muted' },
};
