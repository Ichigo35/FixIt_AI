import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, jwtSubject } from '@/auth/jwt';

// JWT factice : header.payload.signature (payload = { sub: 'user-123', email: 'a@b.co' })
const payload = Buffer.from(JSON.stringify({ sub: 'user-123', email: 'a@b.co' }))
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
const TOKEN = `eyJhbGciOiJFUzI1NiJ9.${payload}.fakesig`;

describe('jwt', () => {
  it('decodeJwtPayload lit le payload', () => {
    expect(decodeJwtPayload(TOKEN)).toMatchObject({ sub: 'user-123', email: 'a@b.co' });
  });

  it('jwtSubject renvoie le sub', () => {
    expect(jwtSubject(TOKEN)).toBe('user-123');
  });

  it('renvoie null sur un token malformé', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(jwtSubject('a.b')).toBeNull();
  });
});
