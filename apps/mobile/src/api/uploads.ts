import { MAX_VIDEO_BYTES, type UploadKind, type UploadResult } from '@fixit/shared';
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

function contentTypeFor(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Lit un fichier local (file://) et l'envoie au Worker. Renvoie l'id de l'image stockée. */
export async function uploadImage(uri: string, kind: UploadKind = 'problem'): Promise<UploadResult> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  const contentType = blob.type && blob.type.startsWith('image/') ? blob.type : contentTypeFor(uri);
  return apiPostBinary<UploadResult>(
    `/uploads?kind=${encodeURIComponent(kind)}`,
    blob,
    contentType,
  );
}

function videoContentTypeFor(uri: string): 'video/mp4' | 'video/quicktime' {
  return uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}

/** Envoie une courte vidéo de diagnostic. Rejette tôt si le fichier dépasse la limite serveur. */
export async function uploadVideo(uri: string): Promise<UploadResult> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new ApiError(413, 'payload_too_large');
  }
  const contentType =
    blob.type === 'video/mp4' || blob.type === 'video/quicktime'
      ? blob.type
      : videoContentTypeFor(uri);
  return apiPostBinary<UploadResult>('/uploads?kind=video', blob, contentType);
}
