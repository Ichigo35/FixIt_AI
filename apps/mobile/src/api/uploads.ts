import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

/**
 * Côté le plus long (px) auquel une photo est ramenée avant l'envoi. Un capteur
 * de téléphone sort du 3000-4000 px ⇒ ~1500-1900 tokens d'image pour Gemini ;
 * 1280 px suffit largement au diagnostic et aux repères, pour ~4× moins de
 * tokens d'entrée (donc de quota) et un upload plus léger.
 */
const MAX_IMAGE_EDGE = 1280;
const JPEG_COMPRESS = 0.72;

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

/** Dimensions d'une image locale (file:// / content://). */
function measureImage(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Redimensionne une photo à `MAX_IMAGE_EDGE` sur son côté le plus long et la
 * réencode en JPEG. Best-effort : toute erreur ⇒ on renvoie l'URI d'origine
 * (un upload ne doit jamais échouer à cause du redimensionnement).
 * Renvoie l'URI (éventuellement nouvelle) + le type MIME à annoncer.
 */
async function downscaleImage(
  uri: string,
): Promise<{ uri: string; mime: string | null }> {
  try {
    const { width, height } = await measureImage(uri);
    const longest = Math.max(width, height);
    if (!longest || longest <= MAX_IMAGE_EDGE) return { uri, mime: null };
    const scale = MAX_IMAGE_EDGE / longest;
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({ compress: JPEG_COMPRESS, format: SaveFormat.JPEG });
    return { uri: out.uri, mime: 'image/jpeg' };
  } catch {
    return { uri, mime: null };
  }
}

/**
 * Lit un fichier local (file:// ou content://) et l'envoie au Worker.
 * La photo est d'abord ramenée à `MAX_IMAGE_EDGE` px (économie d'upload + de
 * tokens Gemini en aval).
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
  const scaled = await downscaleImage(uri);
  const fileRes = await fetch(scaled.uri);
  const blob = await fileRes.blob();
  const contentType = resolveImageContentType([scaled.mime, mimeHint, blob.type, scaled.uri]);
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
