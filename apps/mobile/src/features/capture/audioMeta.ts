/**
 * Helpers purs pour l'enregistrement audio — isolés d'Expo pour rester testables
 * sous Vitest (cf. `apps/mobile/vitest.config.ts`, env node).
 */

/** Formate une durée en secondes vers `m:ss`, éventuellement plafonnée. */
export function formatClock(seconds: number, maxSeconds?: number): string {
  let s = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  if (maxSeconds != null) s = Math.min(s, Math.floor(maxSeconds));
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

/** true si le clip a une durée exploitable pour un diagnostic (au moins ~2 s). */
export function isUsableClip(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 2;
}
