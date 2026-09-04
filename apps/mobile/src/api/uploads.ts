import {
  MAX_VIDEO_BYTES,
  resolveImageContentType,
  resolveVideoContentType,
  type UploadKind,
  type UploadResult,
} from '@fixit/shared';
import { ApiError } from './ApiError';
import { config } from '@/config';
import { apiPostBinary, authBridge } from './client';

/** Source d'image authentifiée pour <Image> (expo-image supporte `headers`). */
export function imageSource(imageId: string) {
  const token = authBridge.getAccessToken();
  return {
    uri: `${config.apiBaseUrl}/uploads/${imageId}`,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  };
}

/** À partir d'une clé R2 `uploads/{id}`. */
export function imageSourceFromKey(r2Key: string | null) {
  if (!r2Key) return null;
  const id = r2Key.split('/').pop();
  return id ? imageSource(id) : null;
}

/** Source vidéo authentifiée pour `expo-video` (`useVideoPlayer` accepte `headers`). */
export function videoSource(videoId: string) {
  const token = authBridge.getAccessToken();
  return {
    uri: `${config.apiBaseUrl}/uploads/${videoId}`,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  };
}

/**
 * Lit un fichier local (file:// ou content://) et l'envoie au Worker.
 * Le type est ramené à une valeur canonique : les appareils Android (MIUI…)
 * renvoient souvent `image/jpg` pour `fetch(content://…).blob().type`, ce que le
 * Worker refusait (415) sur une photo pourtant valide.
 * `mimeHint` = `asset.mimeType` du sélecteur quand il est connu.
 * Renvoie l'id de l'image stockée.
 */
export async function uploadImage(
  uri: string,
  kind: UploadKind = 'problem',
  mimeHint?: string | null,
): Promise<UploadResult> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  const contentType = resolveImageContentType([mimeHint, blob.type, uri]);
  return apiPostBinary<UploadResult>(
    `/uploads?kind=${encodeURIComponent(kind)}`,
    blob,
    contentType,
  );
}

/** Envoie une courte vidéo de diagnostic. Rejette tôt si le fichier dépasse la limite serveur. */
export async function uploadVideo(uri: string, mimeHint?: string | null): Promise<UploadResult> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new ApiError(413, 'payload_too_large');
  }
  const contentType = resolveVideoContentType([mimeHint, blob.type, uri]);
  return apiPostBinary<UploadResult>('/uploads?kind=video', blob, contentType);
}
