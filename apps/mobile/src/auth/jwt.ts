/** Décodage minimal du payload d'un JWT (sans vérification — la vérif est côté Worker). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const decoded = decodeURIComponent(
      json
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jwtSubject(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.sub === 'string' ? payload.sub : null;
}
