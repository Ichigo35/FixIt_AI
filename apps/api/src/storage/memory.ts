import { lowerKeys, type ObjectStorage, type StoredObject } from './types';

export interface MemoryStorage extends ObjectStorage {
  /** Accès direct au contenu, pour les assertions de test. */
  _store: Map<string, StoredObject>;
}

/** Stockage objet en mémoire — tests uniquement. */
export function memoryStorage(): MemoryStorage {
  const store = new Map<string, StoredObject>();
  return {
    _store: store,
    async put(key, data, opts) {
      store.set(key, {
        data,
        contentType: opts.contentType,
        metadata: lowerKeys(opts.metadata),
      });
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
