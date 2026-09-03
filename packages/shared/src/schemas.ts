import { z } from 'zod';
import {
  CATEGORIES,
  DIFFICULTIES,
  RECOMMENDATIONS,
  RISK_LEVELS,
  UPLOAD_KINDS,
} from './constants';

/**
 * Schémas Zod = source de vérité pour les échanges IA <-> serveur <-> client.
 * Toute sortie du modèle est validée par `rawDiagnosisSchema` avant traitement.
 */

export const moneyRangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
});
export type MoneyRange = z.infer<typeof moneyRangeSchema>;

export const partSchema = z.object({
  name: z.string().min(1),
  priceMin: z.number().nonnegative().nullable().optional(),
  priceMax: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  /** true si l'IA connaît un prix fiable ; sinon on affiche "Price unavailable". */
  priceKnown: z.boolean().default(false),
});
export type Part = z.infer<typeof partSchema>;

export const identifiedModelSchema = z.object({
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  confident: z.boolean().default(false),
});
export type IdentifiedModel = z.infer<typeof identifiedModelSchema>;

export const PARTS_AVAILABILITY = ['common', 'uncommon', 'unknown'] as const;
export const WORSENING_RISK = ['low', 'medium', 'high'] as const;

/** Ce que le modèle IA doit renvoyer (JSON contraint). */
export const rawDiagnosisSchema = z.object({
  problem: z.string().min(3),
  confidence: z.number().min(0).max(1),
  severity: z.enum(RISK_LEVELS),
  difficulty: z.enum(DIFFICULTIES),
  possibleCauses: z.array(z.string().min(1)).min(1).max(6),
  recommendedAction: z.string().min(1),
  needsProfessional: z.boolean(),
  /** Dangers identifiés, en tokens : "mains_electricity", "gas", "high_voltage", ... */
  hazards: z.array(z.string()).default([]),
  identifiedModel: identifiedModelSchema.nullable().optional(),
  estimatedTimeMinutes: z.number().int().positive().nullable().optional(),
  estimatedStepCount: z.number().int().min(1).max(30).default(4),
  estimatedCost: moneyRangeSchema.nullable().optional(),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(partSchema).default([]),
  partsAvailability: z.enum(PARTS_AVAILABILITY).default('unknown'),
  riskOfWorseningDamage: z.enum(WORSENING_RISK).default('medium'),
  /** Questions à poser si l'image/description ne suffit pas. */
  moreInfoNeeded: z.array(z.string().min(1)).default([]),
});
export type RawDiagnosis = z.infer<typeof rawDiagnosisSchema>;

/** Compétence requise déduite de la difficulté. */
export function skillForDifficulty(
  difficulty: RawDiagnosis['difficulty'],
): 'basic' | 'intermediate' | 'advanced' | 'pro' {
  switch (difficulty) {
    case 'EASY':
      return 'basic';
    case 'INTERMEDIATE':
      return 'intermediate';
    case 'ADVANCED':
      return 'advanced';
    default:
      return 'pro';
  }
}

/**
 * Repère sur une photo envoyée par l'utilisateur : « la vis est ICI ».
 * `box` suit la convention Gemini : [ymin, xmin, ymax, xmax] normalisés 0..1000.
 * `imageIndex` pointe dans `DiagnosisResult.input.imageIds` (même ordre).
 */
export const photoAnchorSchema = z.object({
  imageIndex: z.number().int().min(0).max(5),
  box: z.tuple([
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
  ]),
  label: z.string().min(1).max(60),
});
export type PhotoAnchor = z.infer<typeof photoAnchorSchema>;

/**
 * Plan visuel d'une étape, produit dans le même appel IA que le guide
 * (aucune requête supplémentaire, donc aucun quota supplémentaire).
 * `scene` est validée côté client via `coerceScene` — on la garde en `string`
 * ici pour ne jamais rejeter un guide à cause d'un libellé inattendu.
 */
export const stepVisualSchema = z.object({
  scene: z.string().max(40).default('generic'),
  /** Ce que l'on regarde, en 2-4 mots (« les 4 vis du panneau arrière »). */
  subject: z.string().max(120).default(''),
  /** Légende courte sous l'illustration (« Dévisser dans le sens antihoraire »). */
  caption: z.string().max(140).default(''),
  /** Repères sur les photos de l'utilisateur (0 à 3). */
  anchors: z.array(photoAnchorSchema).max(3).default([]),
});
export type StepVisual = z.infer<typeof stepVisualSchema>;

export const repairStepSchema = z.object({
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  instruction: z.string().min(1),
  safetyWarning: z.string().min(1).nullable().optional(),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(z.string().min(1)).default([]),
  /** Plan visuel (facultatif : les guides mis en cache avant cette version n'en ont pas). */
  visual: stepVisualSchema.nullable().optional(),
  /** Points de contrôle à cocher pour valider l'étape (0 à 4). */
  checks: z.array(z.string().min(1).max(160)).max(4).default([]),
  estimatedMinutes: z.number().int().positive().max(600).nullable().optional(),
});
export type RepairStep = z.infer<typeof repairStepSchema>;

export const repairGuideSchema = z.object({
  summary: z.string().min(1),
  difficulty: z.enum(DIFFICULTIES),
  estimatedTimeMinutes: z.number().int().positive().nullable(),
  requiredSkill: z.enum(['basic', 'intermediate', 'advanced', 'pro']),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(partSchema).default([]),
  optional: z.array(z.string().min(1)).default([]),
  /** Avertissements de sécurité généraux, avant de commencer. */
  generalWarnings: z.array(z.string().min(1)).default([]),
  steps: z.array(repairStepSchema).min(1).max(20),
});
export type RepairGuide = z.infer<typeof repairGuideSchema>;

/** Parse permissif de la sortie modèle pour le guide de réparation. */
export function coerceRepairGuide(input: unknown): RepairGuide {
  const obj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof obj.difficulty === 'string') obj.difficulty = obj.difficulty.toUpperCase();
  if (typeof obj.requiredSkill === 'string') obj.requiredSkill = obj.requiredSkill.toLowerCase();
  if (Array.isArray(obj.steps)) {
    // Ré-indexation 0-based par position (on ignore la numérotation du modèle).
    obj.steps = obj.steps.map((s, i) => {
      const step = (typeof s === 'object' && s !== null ? s : {}) as Record<string, unknown>;
      step.index = i;
      step.visual = sanitizeVisual(step.visual);
      return step;
    });
  }
  return repairGuideSchema.parse(obj);
}

/**
 * Nettoie le plan visuel produit par le modèle : un repère photo mal formé
 * (boîte incomplète, hors bornes, inversée) est **écarté** plutôt que de faire
 * échouer tout le guide. Renvoie `null` si rien d'exploitable.
 */
function sanitizeVisual(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return null;
  const v = { ...(input as Record<string, unknown>) };
  if (typeof v.scene !== 'string') delete v.scene;
  if (typeof v.subject !== 'string') delete v.subject;
  if (typeof v.caption !== 'string') delete v.caption;

  const raw = Array.isArray(v.anchors) ? v.anchors : [];
  v.anchors = raw.flatMap((a) => {
    if (typeof a !== 'object' || a === null) return [];
    const anchor = a as Record<string, unknown>;
    const box = Array.isArray(anchor.box) ? anchor.box.map(Number) : [];
    if (box.length !== 4 || box.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)) return [];
    const [ymin, xmin, ymax, xmax] = box as [number, number, number, number];
    // Une boîte dégénérée (hauteur ou largeur nulle) n'est pas affichable.
    if (ymax - ymin < 1 || xmax - xmin < 1) return [];
    const label = typeof anchor.label === 'string' ? anchor.label.trim().slice(0, 60) : '';
    const index = Number(anchor.imageIndex);
    if (!label || !Number.isInteger(index) || index < 0 || index > 5) return [];
    return [{ imageIndex: index, box: [ymin, xmin, ymax, xmax], label }];
  });
  return v;
}

/* --------------------------- Réparation interactive --------------------------- */

/**
 * Verdict d'une vérification d'étape par l'IA (vision).
 * `pass` = fait correctement · `retry` = à refaire/ajuster · `unsafe` = danger
 * observé (l'app propose d'arrêter) · `unclear` = photo insuffisante.
 */
export const STEP_VERDICTS = ['pass', 'retry', 'unsafe', 'unclear'] as const;
export type StepVerdict = (typeof STEP_VERDICTS)[number];

/** Sortie brute du modèle pour la vérification d'une étape. */
export const rawStepCheckSchema = z.object({
  verdict: z.enum(STEP_VERDICTS),
  summary: z.string().min(1),
  advice: z.array(z.string().min(1)).max(6).default([]),
  /** true si l'IA repère un danger — l'app propose d'arrêter et d'appeler un pro. */
  escalate: z.boolean().default(false),
});
export type RawStepCheck = z.infer<typeof rawStepCheckSchema>;

const STEP_VERDICT_ALIASES: Record<string, StepVerdict> = {
  pass: 'pass',
  ok: 'pass',
  good: 'pass',
  done: 'pass',
  complete: 'pass',
  completed: 'pass',
  looks_good: 'pass',
  success: 'pass',
  retry: 'retry',
  redo: 'retry',
  again: 'retry',
  needs_work: 'retry',
  incomplete: 'retry',
  not_done: 'retry',
  fail: 'retry',
  unsafe: 'unsafe',
  danger: 'unsafe',
  dangerous: 'unsafe',
  stop: 'unsafe',
  hazard: 'unsafe',
  unclear: 'unclear',
  unknown: 'unclear',
  uncertain: 'unclear',
  cant_tell: 'unclear',
  cannot_tell: 'unclear',
};

/** Parse permissif de la sortie modèle pour la vérification d'étape. */
export function coerceRawStepCheck(input: unknown): RawStepCheck {
  const obj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof obj.verdict === 'string') {
    const key = obj.verdict
      .toLowerCase()
      .trim()
      .replace(/['’.]/g, '')
      .replace(/[\s-]+/g, '_');
    obj.verdict = STEP_VERDICT_ALIASES[key] ?? key;
  }
  if (obj.escalate == null && obj.verdict === 'unsafe') obj.escalate = true;
  if (typeof obj.advice === 'string') obj.advice = [obj.advice];
  return rawStepCheckSchema.parse(obj);
}

/** Une vérification d'étape enregistrée dans la session. */
export const repairCheckSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  imageId: z.string(),
  verdict: z.enum(STEP_VERDICTS),
  summary: z.string(),
  advice: z.array(z.string()).default([]),
  escalate: z.boolean().default(false),
  createdAt: z.string(),
});
export type RepairCheck = z.infer<typeof repairCheckSchema>;

export const REPAIR_SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type RepairSessionStatus = (typeof REPAIR_SESSION_STATUSES)[number];

/** État d'une session de réparation interactive (autorité serveur). */
export const repairSessionSchema = z.object({
  id: z.string(),
  diagnosisId: z.string(),
  status: z.enum(REPAIR_SESSION_STATUSES),
  /** Index de la prochaine étape non validée (0-based). */
  currentStep: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  checks: z.array(repairCheckSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RepairSession = z.infer<typeof repairSessionSchema>;

export const verifyStepRequestSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  imageId: z.string().uuid(),
  note: z.string().max(600).default(''),
});
export type VerifyStepRequest = z.infer<typeof verifyStepRequestSchema>;

/* ------------------------------ Requêtes API ------------------------------ */

export const createDiagnosisRequestSchema = z.object({
  category: z.enum(CATEGORIES).nullable().optional(),
  description: z.string().max(2000).default(''),
  brand: z.string().max(120).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  serialNumber: z.string().max(120).nullable().optional(),
  imageIds: z.array(z.string().uuid()).max(6).default([]),
  videoIds: z.array(z.string().uuid()).max(1).default([]),
});
export type CreateDiagnosisRequest = z.infer<typeof createDiagnosisRequestSchema>;

export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

/** Photos + vidéo : tout ce que `POST /uploads` sait relayer. */
export const MEDIA_CONTENT_TYPES = [...UPLOAD_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

/** Taille maximale acceptée par `POST /uploads` pour une photo (octets). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Taille maximale acceptée pour une vidéo de diagnostic (octets). Le mobile vise ~15 s. */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
/** Durée cible d'une vidéo de diagnostic (le mobile coupe l'enregistrement à cette valeur). */
export const MAX_VIDEO_DURATION_SECONDS = 15;

export const REPAIR_OUTCOMES = ['fixed', 'not_fixed', 'pro'] as const;
export type RepairOutcome = (typeof REPAIR_OUTCOMES)[number];

export const historyRequestSchema = z.object({
  outcome: z.enum(REPAIR_OUTCOMES),
  feedbackWorked: z.boolean().nullable().optional(),
  feedbackNote: z.string().max(1000).nullable().optional(),
  beforeImageId: z.string().uuid().nullable().optional(),
  afterImageId: z.string().uuid().nullable().optional(),
});
export type HistoryRequest = z.infer<typeof historyRequestSchema>;

export const uploadRequestSchema = z.object({
  contentType: z.enum(MEDIA_CONTENT_TYPES),
  kind: z.enum(UPLOAD_KINDS).default('problem'),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const uploadResultSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(UPLOAD_KINDS),
  bytes: z.number().int().nonnegative(),
  contentType: z.enum(MEDIA_CONTENT_TYPES),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;

/* ------------------------------ Réponses API ----------------------------- */

export const safetyResultSchema = z.object({
  riskLevel: z.enum(RISK_LEVELS),
  recommendation: z.enum(RECOMMENDATIONS),
  forcedStop: z.boolean(),
  reasons: z.array(z.string()),
});
export type SafetyResult = z.infer<typeof safetyResultSchema>;

export const repairabilitySchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.string(),
});
export type Repairability = z.infer<typeof repairabilitySchema>;

export const diagnosisResultSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  category: z.enum(CATEGORIES).nullable(),
  input: z.object({
    description: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    imageIds: z.array(z.string()),
    videoIds: z.array(z.string()).default([]),
  }),
  diagnosis: rawDiagnosisSchema,
  safety: safetyResultSchema,
  repairability: repairabilitySchema,
});
export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;

/** Parse permissif : nettoie les cas fréquents de sortie modèle avant validation stricte. */
export function coerceRawDiagnosis(input: unknown): RawDiagnosis {
  const obj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof obj.confidence === 'number' && obj.confidence > 1) {
    obj.confidence = obj.confidence / 100;
  }
  if (typeof obj.severity === 'string') {
    obj.severity = obj.severity.toUpperCase();
  }
  if (typeof obj.difficulty === 'string') {
    obj.difficulty = obj.difficulty.toUpperCase();
  }
  return rawDiagnosisSchema.parse(obj);
}
