import {
  AUDIO_CONTENT_TYPES,
  MEDIA_CONTENT_TYPES,
  UPLOAD_CONTENT_TYPES,
  VIDEO_CONTENT_TYPES,
  type AudioContentType,
  type MediaContentType,
  type UploadContentType,
  type VideoContentType,
} from './schemas';

/**
 * Les appareils (surtout Android / MediaStore) et les navigateurs renvoient des
 * variantes non canoniques du même type MIME : `image/jpg`, `IMAGE/JPEG`,
 * `video/mov`… `POST /uploads` n'accepte qu'une liste stricte, d'où des 415 sur
 * des photos parfaitement valides. On ramène tout à la forme canonique ici,
 * partagé entre le mobile (avant l'envoi) et le Worker (à la réception).
 */
const CONTENT_TYPE_ALIASES: Record<string, MediaContentType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/jpe': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/jfif': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
  'video/mp4': 'video/mp4',
  'video/x-m4v': 'video/mp4',
  'video/m4v': 'video/mp4',
  'video/quicktime': 'video/quicktime',
  'video/mov': 'video/quicktime',
  'video/x-quicktime': 'video/quicktime',
  'audio/mp4': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/aacp': 'audio/aac',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/ogg': 'audio/ogg',
  'audio/x-ogg': 'audio/ogg',
};

const EXTENSION_TYPES: Record<string, MediaContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  // Extensions sans ambiguïté audio (un `.mp4` reste mappé vers la vidéo ci-dessus ;
  // un clip audio expo-audio porte de toute façon un type MIME `audio/*` explicite).
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
};

/** Ramène un type MIME (éventuellement bruité) à une valeur acceptée, ou `null`. */
export function normalizeMediaContentType(
  raw: string | null | undefined,
): MediaContentType | null {
  if (!raw) return null;
  const clean = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!clean) return null;
  if (CONTENT_TYPE_ALIASES[clean]) return CONTENT_TYPE_ALIASES[clean];
  return (MEDIA_CONTENT_TYPES as readonly string[]).includes(clean)
    ? (clean as MediaContentType)
    : null;
}

/** Déduit le type d'un nom de fichier ou d'une URI (`photo.JPG`, `file://…/x.mov`). */
export function mediaContentTypeFromName(
  name: string | null | undefined,
): MediaContentType | null {
  if (!name) return null;
  const match = name.toLowerCase().split(/[?#]/)[0]?.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  return ext ? (EXTENSION_TYPES[ext] ?? null) : null;
}

function isUploadType(type: MediaContentType | null): type is UploadContentType {
  return type != null && (UPLOAD_CONTENT_TYPES as readonly string[]).includes(type);
}

function isVideoType(type: MediaContentType | null): type is VideoContentType {
  return type != null && (VIDEO_CONTENT_TYPES as readonly string[]).includes(type);
}

function isAudioType(type: MediaContentType | null): type is AudioContentType {
  return type != null && (AUDIO_CONTENT_TYPES as readonly string[]).includes(type);
}

/** true si le type MIME (éventuellement bruité) désigne un clip audio accepté. */
export function isAudioContentType(raw: string | null | undefined): boolean {
  return isAudioType(normalizeMediaContentType(raw));
}

/** Premier indice qui donne un type d'image valide, sinon `image/jpeg`. */
export function resolveImageContentType(
  hints: Array<string | null | undefined>,
): UploadContentType {
  for (const hint of hints) {
    const direct = normalizeMediaContentType(hint);
    if (isUploadType(direct)) return direct;
    const byName = mediaContentTypeFromName(hint);
    if (isUploadType(byName)) return byName;
  }
  return 'image/jpeg';
}

/** Premier indice qui donne un type vidéo valide, sinon `video/mp4`. */
export function resolveVideoContentType(
  hints: Array<string | null | undefined>,
): VideoContentType {
  for (const hint of hints) {
    const direct = normalizeMediaContentType(hint);
    if (isVideoType(direct)) return direct;
    const byName = mediaContentTypeFromName(hint);
    if (isVideoType(byName)) return byName;
  }
  return 'video/mp4';
}

/** Premier indice qui donne un type audio valide, sinon `audio/mp4` (m4a/AAC). */
export function resolveAudioContentType(
  hints: Array<string | null | undefined>,
): AudioContentType {
  for (const hint of hints) {
    const direct = normalizeMediaContentType(hint);
    if (isAudioType(direct)) return direct;
    const byName = mediaContentTypeFromName(hint);
    if (isAudioType(byName)) return byName;
  }
  return 'audio/mp4';
}
