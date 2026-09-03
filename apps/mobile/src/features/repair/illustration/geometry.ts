import type { PhotoAnchor } from '@fixit/shared';

/**
 * Géométrie des repères photo — pure, testable hors React/Expo.
 *
 * Convention d'entrée : `box = [ymin, xmin, ymax, xmax]` normalisé 0..1000
 * (convention Gemini). Sortie : un rectangle en **pourcentages** du conteneur,
 * directement utilisable en style RN, le conteneur étant réglé sur le ratio
 * exact de la photo (`contentFit="contain"` ⇒ l'image remplit sa boîte).
 */
export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Taille minimale d'un repère (%) : en dessous, la cible devient invisible. */
const MIN_SIZE = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Boîte 0..1000 -> rectangle en % du conteneur. Tolérant : coordonnées
 * inversées remises dans l'ordre, valeurs hors bornes ramenées dans le cadre,
 * repère trop petit élargi autour de son centre.
 */
export function anchorRect(box: PhotoAnchor['box']): AnchorRect {
  const [rawYmin, rawXmin, rawYmax, rawXmax] = box.map((n) =>
    Number.isFinite(n) ? clamp(n, 0, 1000) : 0,
  ) as [number, number, number, number];

  const ymin = Math.min(rawYmin, rawYmax) / 10;
  const ymax = Math.max(rawYmin, rawYmax) / 10;
  const xmin = Math.min(rawXmin, rawXmax) / 10;
  const xmax = Math.max(rawXmin, rawXmax) / 10;

  const grow = (min: number, max: number): [number, number] => {
    const size = max - min;
    if (size >= MIN_SIZE) return [min, max];
    const center = (min + max) / 2;
    const half = MIN_SIZE / 2;
    const start = clamp(center - half, 0, 100 - MIN_SIZE);
    return [start, start + MIN_SIZE];
  };

  const [top, bottom] = grow(ymin, ymax);
  const [left, right] = grow(xmin, xmax);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Premier repère exploitable pour cette étape : celui qui pointe une photo
 * réellement disponible. `null` si l'étape n'en a pas (cas le plus courant).
 */
export function pickAnchor(
  anchors: readonly PhotoAnchor[] | undefined,
  imageCount: number,
): PhotoAnchor | null {
  if (!anchors || imageCount <= 0) return null;
  return anchors.find((a) => a.imageIndex >= 0 && a.imageIndex < imageCount) ?? null;
}

/** Le libellé du repère se place sous la boîte s'il déborderait en haut. */
export function labelBelow(rect: AnchorRect): boolean {
  return rect.top < 12;
}
