export type Tone = 'success' | 'caution' | 'danger' | 'neutral';

export const STATUS_META: Record<string, { label: string; tone: Tone; emoji: string }> = {
  open: { label: 'Open', tone: 'neutral', emoji: '•' },
  fixed: { label: 'Fixed', tone: 'success', emoji: '🟢' },
  pro_recommended: { label: 'Professional', tone: 'caution', emoji: '🟡' },
  abandoned: { label: 'Abandoned', tone: 'neutral', emoji: '•' },
};

export function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.open!;
}

/** "2 days ago" style. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} weeks ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} months ago`;
  return `${Math.floor(diff / (365 * day))} years ago`;
}
