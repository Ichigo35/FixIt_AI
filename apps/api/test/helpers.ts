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

export const baseEnv = {
  APP_ENV: 'test',
  FREE_MONTHLY_DIAGNOSES: '3',
  GEMINI_MODEL: 'gemini-3.6-flash',
};

export const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
