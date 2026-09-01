/** Objet lu depuis le stockage. `metadata` : clés en minuscules. */
export interface StoredObject {
  data: ArrayBuffer;
  contentType: string;
  metadata: Record<string, string>;
  etag?: string;
}

export interface PutOptions {
  contentType: string;
  /** Métadonnées utilisateur ; les clés sont normalisées en minuscules. */
  metadata?: Record<string, string>;
}

/**
 * Stockage objet minimal utilisé par l'API (images des diagnostics).
 * Implémentations : `s3Storage` (Neon Object Storage) et `memoryStorage` (tests).
 */
export interface ObjectStorage {
  put(key: string, data: ArrayBuffer, opts: PutOptions): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

/** Normalise les clés de métadonnées (S3 les renvoie toujours en minuscules). */
export function lowerKeys(meta?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta ?? {})) out[k.toLowerCase()] = v;
  return out;
}
