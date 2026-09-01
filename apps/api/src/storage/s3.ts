import { AwsClient } from 'aws4fetch';
import { lowerKeys, type ObjectStorage, type StoredObject } from './types';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Stockage S3-compatible (Neon Object Storage) pour Cloudflare Workers.
 * Signature SigV4 via `aws4fetch`, adressage *path-style* obligatoire
 * (`{endpoint}/{bucket}/{key}`).
 */
export function s3Storage(cfg: S3Config): ObjectStorage {
  const aws = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region,
    service: 's3',
  });

  const base = cfg.endpoint.replace(/\/$/, '');
  const url = (key: string) => `${base}/${cfg.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async put(key, data, opts) {
      const headers: Record<string, string> = { 'content-type': opts.contentType };
      for (const [k, v] of Object.entries(opts.metadata ?? {})) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = v;
      }
      const res = await aws.fetch(url(key), { method: 'PUT', body: data, headers });
      if (!res.ok) {
        throw new Error(`S3 PUT ${key} -> ${res.status} ${await res.text().catch(() => '')}`);
      }
    },

    async get(key): Promise<StoredObject | null> {
      const res = await aws.fetch(url(key), { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`S3 GET ${key} -> ${res.status} ${await res.text().catch(() => '')}`);
      }
      const metadata: Record<string, string> = {};
      res.headers.forEach((value, name) => {
        if (name.toLowerCase().startsWith('x-amz-meta-')) {
          metadata[name.toLowerCase().slice('x-amz-meta-'.length)] = value;
        }
      });
      return {
        data: await res.arrayBuffer(),
        contentType: res.headers.get('content-type') ?? 'application/octet-stream',
        metadata: lowerKeys(metadata),
        etag: res.headers.get('etag') ?? undefined,
      };
    },

    async delete(key) {
      const res = await aws.fetch(url(key), { method: 'DELETE' });
      // S3 DELETE renvoie 204 même si l'objet n'existe pas.
      if (!res.ok && res.status !== 404) {
        throw new Error(`S3 DELETE ${key} -> ${res.status} ${await res.text().catch(() => '')}`);
      }
    },
  };
}
