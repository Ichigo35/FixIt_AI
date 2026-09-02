import type { Env } from '../env';

/** Liste normalisée des emails administrateurs (var `ADMIN_EMAILS`, séparés par des virgules). */
export function adminEmails(env: Pick<Env, 'ADMIN_EMAILS'>): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** `true` si l'email fait partie des administrateurs déclarés. */
export function isAdminEmail(
  env: Pick<Env, 'ADMIN_EMAILS'>,
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return adminEmails(env).includes(email.trim().toLowerCase());
}
