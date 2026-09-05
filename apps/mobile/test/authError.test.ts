import { describe, expect, it } from 'vitest';
import { isDefinitiveAuthFailure, StackAuthError } from '@/auth/authError';

describe('isDefinitiveAuthFailure', () => {
  it('déconnecte sur un refresh token réellement invalide (4xx hors 429)', () => {
    expect(isDefinitiveAuthFailure(new StackAuthError('refresh_token_expired', 'x', 401))).toBe(
      true,
    );
    expect(isDefinitiveAuthFailure(new StackAuthError('bad_request', 'x', 400))).toBe(true);
  });

  it('ne déconnecte pas sur une panne serveur passagère (5xx)', () => {
    expect(isDefinitiveAuthFailure(new StackAuthError('http_500', 'x', 500))).toBe(false);
    expect(isDefinitiveAuthFailure(new StackAuthError('http_503', 'x', 503))).toBe(false);
  });

  it('ne déconnecte pas sur une limite de débit (429)', () => {
    expect(isDefinitiveAuthFailure(new StackAuthError('rate_limited', 'x', 429))).toBe(false);
  });

  it('ne déconnecte pas sur une erreur réseau (fetch a échoué avant réponse HTTP)', () => {
    expect(isDefinitiveAuthFailure(new TypeError('Network request failed'))).toBe(false);
  });

  it('ne déconnecte pas quand le statut est inconnu', () => {
    expect(isDefinitiveAuthFailure(new StackAuthError('unknown', 'x'))).toBe(false);
  });
});
