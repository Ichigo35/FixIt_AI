import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Charge apps/api/.dev.vars pour les tests d'intégration (Neon). */
function loadDevVars(): Record<string, string> {
  try {
    const raw = readFileSync(join(__dirname, '..', '.dev.vars'), 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
    return out;
  } catch {
    return {};
  }
}

const devVars = loadDevVars();

/** Env de test : provider mock (pas de GEMINI_API_KEY), + Neon si dispo. */
export const baseEnv: Record<string, string | undefined> = {
  APP_ENV: 'test',
  FREE_MONTHLY_DIAGNOSES: '3',
  GEMINI_MODEL: 'gemini-3.6-flash',
  DATABASE_URL: process.env.DATABASE_URL ?? devVars.DATABASE_URL,
  STACK_PROJECT_ID: devVars.STACK_PROJECT_ID ?? '3432abc2-2b77-4b7b-acff-0686a7b99697',
  STACK_JWKS_URL:
    devVars.STACK_JWKS_URL ??
    'https://api.stack-auth.com/api/v1/projects/3432abc2-2b77-4b7b-acff-0686a7b99697/.well-known/jwks.json',
};

export const hasDb = Boolean(baseEnv.DATABASE_URL);

/** En-tête de contournement d'auth pour les tests (dev only). */
export function devAuth(userId: string): Record<string, string> {
  return { 'x-dev-user-id': userId };
}

interface Stored {
  body: Uint8Array;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

/** R2Bucket minimal en mémoire pour les tests. */
export function memoryBucket() {
  const store = new Map<string, Stored>();
  const wrap = (key: string, s: Stored) => ({
    get body() {
      return s.body;
    },
    httpMetadata: s.httpMetadata,
    httpEtag: '"test"',
    customMetadata: s.customMetadata,
    async arrayBuffer() {
      return s.body.buffer.slice(s.body.byteOffset, s.body.byteOffset + s.body.byteLength);
    },
    async text() {
      return new TextDecoder().decode(s.body);
    },
    async json() {
      return JSON.parse(new TextDecoder().decode(s.body));
    },
    key,
  });

  return {
    async put(
      key: string,
      value: ArrayBuffer | string,
      opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
    ) {
      const body =
        typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      store.set(key, { body, ...opts });
    },
    async get(key: string) {
      const found = store.get(key);
      return found ? wrap(key, found) : null;
    },
    async delete(key: string) {
      store.delete(key);
    },
    _store: store,
  };
}

export const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
