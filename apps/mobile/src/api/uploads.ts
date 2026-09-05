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
 * Retag un Blob RN avec le type MIME canonique qu'on veut réellement envoyer.
 *
 * Fixer le header HTTP `content-type` ne suffit PAS : le pont natif (Android
 * `BlobModule.toRequestBody` / iOS `RCTBlobManager.resolveMultipartBlock`)
 * lit en priorité le type **interne du Blob** (`blob.data.type`, dérivé par
 * l'OS — `ContentResolver.getType()` sur Android, UTI sur iOS) et l'utilise
 * comme Content-Type réel de la requête, **quel que soit notre header** dès
 * que ce type OS est non vide. Sur certains appareils (constaté sur un OPPO/
 * ColorOS avec une photo de galerie) cette valeur OS est soit non canonique,
 * soit invalide pour OkHttp/`MediaType.parse` → **aucun** Content-Type n'est
 * envoyé du tout, et le Worker répond 415 même si le header JS était correct.
 * `Blob.slice()` crée une nouvelle vue sur les mêmes octets (pas de copie)
 * avec le type qu'on lui donne : c'est le seul moyen fiable de contrôler ce
 * qui part sur le réseau, sur les deux plateformes.
 */
function retag(blob: Blob, contentType: string): Blob {
  return blob.slice(0, blob.size, contentType);
}

/**
 * Lit un fichier local (file:// ou content://) et l'envoie au Worker.
 * Le type est ramené à une valeur canonique : les appareils Android (MIUI,
 * OPPO/ColorOS…) renvoient souvent un type non canonique, voire invalide,
 * pour `fetch(content://…).blob().type` — voir `retag()`.
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
    retag(blob, contentType),
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
  return apiPostBinary<UploadResult>('/uploads?kind=video', retag(blob, contentType), contentType);
}
