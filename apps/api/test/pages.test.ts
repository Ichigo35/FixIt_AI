import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { baseEnv } from './helpers';

describe('pages publiques HTML', () => {
  it.each(['/', '/privacy', '/terms'])('GET %s renvoie du HTML', async (path) => {
    const app = createApp();
    const res = await app.request(path, {}, baseEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('FixIt AI');
  });

  it('la CSP des pages HTML autorise les styles inline', async () => {
    const app = createApp();
    const res = await app.request('/privacy', {}, baseEnv);
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("style-src 'unsafe-inline'");
  });

  it('la CSP des routes JSON reste verrouillée', async () => {
    const app = createApp();
    const res = await app.request('/health', {}, baseEnv);
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
  });

  it('/privacy mentionne les sous-traitants clés et le contact', async () => {
    const app = createApp();
    const html = await (await app.request('/privacy', {}, baseEnv)).text();
    expect(html).toContain('Gemini');
    expect(html).toContain('Neon');
    expect(html).toContain('tcha.jimmy@gmail.com');
  });
});
