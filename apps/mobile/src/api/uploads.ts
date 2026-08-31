import type { ImageKind, UploadResult } from '@fixit/shared';
import { apiPostBinary } from './client';

function contentTypeFor(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Lit un fichier local (file://) et l'envoie au Worker. Renvoie l'id de l'image stockée. */
export async function uploadImage(uri: string, kind: ImageKind = 'problem'): Promise<UploadResult> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  const contentType = blob.type && blob.type.startsWith('image/') ? blob.type : contentTypeFor(uri);
  return apiPostBinary<UploadResult>(
    `/uploads?kind=${encodeURIComponent(kind)}`,
    blob,
    contentType,
  );
}
