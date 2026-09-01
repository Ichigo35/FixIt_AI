import { Hono } from 'hono';
import {
  IMAGE_KINDS,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  type ImageKind,
  type UploadContentType,
} from '@fixit/shared';
import { requireAuth } from '../auth/middleware';
import { getStorage } from '../storage';
import type { AppEnv } from '../types';

const CONTENT_TYPES = new Set<string>(UPLOAD_CONTENT_TYPES);
const KINDS = new Set<string>(IMAGE_KINDS);

/** Clé d'objet plate ; l'appartenance est vérifiée via `metadata.userid`. */
function objectKey(id: string): string {
  return `uploads/${id}`;
}

export const uploads = new Hono<AppEnv>();
uploads.use('*', requireAuth);

/** POST /uploads — corps = octets bruts, header Content-Type requis. Relais vers le stockage objet. */
uploads.post('/', async (c) => {
  const contentType = (c.req.header('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!CONTENT_TYPES.has(contentType)) {
    return c.json({ error: 'unsupported_media_type', allowed: [...CONTENT_TYPES] }, 415);
  }

  const kindParam = c.req.query('kind') ?? 'problem';
  const kind: ImageKind = KINDS.has(kindParam) ? (kindParam as ImageKind) : 'problem';

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: 'empty_body' }, 400);
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: 'payload_too_large', maxBytes: MAX_UPLOAD_BYTES }, 413);
  }
  const storage = getStorage(c.env);
  if (!storage) return c.json({ error: 'storage_unavailable' }, 503);

  const id = crypto.randomUUID();
  await storage.put(objectKey(id), body, {
    contentType,
    metadata: {
      id,
      kind,
      userid: c.get('userId'),
      uploadedat: new Date().toISOString(),
    },
  });

  return c.json(
    { id, kind, bytes: body.byteLength, contentType: contentType as UploadContentType },
    201,
  );
});

/** GET /uploads/:id — renvoie l'image si elle appartient à l'utilisateur. */
uploads.get('/:id', async (c) => {
  const storage = getStorage(c.env);
  if (!storage) return c.json({ error: 'storage_unavailable' }, 503);
  const object = await storage.get(`uploads/${c.req.param('id')}`);
  if (!object) return c.json({ error: 'not_found' }, 404);
  if (object.metadata.userid && object.metadata.userid !== c.get('userId')) {
    return c.json({ error: 'forbidden' }, 403);
  }

  return new Response(object.data, {
    headers: {
      'content-type': object.contentType,
      'cache-control': 'private, max-age=3600',
      ...(object.etag ? { etag: object.etag } : {}),
    },
  });
});

uploads.delete('/:id', async (c) => {
  const storage = getStorage(c.env);
  if (!storage) return c.json({ error: 'storage_unavailable' }, 503);
  const key = `uploads/${c.req.param('id')}`;
  const object = await storage.get(key);
  if (object && object.metadata.userid && object.metadata.userid !== c.get('userId')) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await storage.delete(key);
  return c.body(null, 204);
});
