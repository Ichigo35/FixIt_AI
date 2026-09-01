import type { Env } from '../env';
import { s3Storage } from './s3';
import type { ObjectStorage } from './types';

export type { ObjectStorage, StoredObject } from './types';
export { s3Storage } from './s3';
export { memoryStorage, type MemoryStorage } from './memory';

const cache = new WeakMap<object, ObjectStorage | null>();

/**
 * Résout le stockage objet pour une requête :
 * 1. `env.STORAGE` s'il est fourni (tests) ;
 * 2. sinon un client S3 construit depuis les variables `S3_*` (Neon Object Storage) ;
 * 3. sinon `null` → les routes renvoient `503 storage_unavailable`.
 */
export function getStorage(env: Env): ObjectStorage | null {
  if (env.STORAGE) return env.STORAGE;

  const cached = cache.get(env);
  if (cached !== undefined) return cached;

  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  const storage =
    S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
      ? s3Storage({
          endpoint: S3_ENDPOINT,
          region: env.S3_REGION ?? 'us-east-2',
          bucket: S3_BUCKET,
          accessKeyId: S3_ACCESS_KEY_ID,
          secretAccessKey: S3_SECRET_ACCESS_KEY,
        })
      : null;

  cache.set(env, storage);
  return storage;
}
