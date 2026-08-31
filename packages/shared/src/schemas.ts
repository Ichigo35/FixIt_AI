import { z } from 'zod';
import {
  CATEGORIES,
  DIFFICULTIES,
  IMAGE_KINDS,
  RECOMMENDATIONS,
  RISK_LEVELS,
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

/** Ce que le modèle IA doit renvoyer (JSON contraint). */
export const rawDiagnosisSchema = z.object({
  problem: z.string().min(3),
  confidence: z.number().min(0).max(1),
  severity: z.enum(RISK_LEVELS),
  possibleCauses: z.array(z.string().min(1)).min(1).max(6),
  recommendedAction: z.string().min(1),
  needsProfessional: z.boolean(),
  /** Dangers identifiés, en tokens : "mains_electricity", "gas", "high_voltage", ... */
  hazards: z.array(z.string()).default([]),
  identifiedModel: identifiedModelSchema.nullable().optional(),
  estimatedTimeMinutes: z.number().int().positive().nullable().optional(),
  estimatedCost: moneyRangeSchema.nullable().optional(),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(partSchema).default([]),
  /** Questions à poser si l'image/description ne suffit pas. */
  moreInfoNeeded: z.array(z.string().min(1)).default([]),
});
export type RawDiagnosis = z.infer<typeof rawDiagnosisSchema>;

export const repairStepSchema = z.object({
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  instruction: z.string().min(1),
  safetyWarning: z.string().min(1).nullable().optional(),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(z.string().min(1)).default([]),
});
export type RepairStep = z.infer<typeof repairStepSchema>;

export const repairGuideSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  estimatedTimeMinutes: z.number().int().positive().nullable(),
  requiredSkill: z.enum(['basic', 'intermediate', 'advanced', 'pro']),
  tools: z.array(z.string().min(1)).default([]),
  parts: z.array(partSchema).default([]),
  optional: z.array(z.string().min(1)).default([]),
  steps: z.array(repairStepSchema).min(1),
});
export type RepairGuide = z.infer<typeof repairGuideSchema>;

/* ------------------------------ Requêtes API ------------------------------ */

export const createDiagnosisRequestSchema = z.object({
  category: z.enum(CATEGORIES).nullable().optional(),
  description: z.string().max(2000).default(''),
  brand: z.string().max(120).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  serialNumber: z.string().max(120).nullable().optional(),
  imageIds: z.array(z.string().uuid()).max(6).default([]),
});
export type CreateDiagnosisRequest = z.infer<typeof createDiagnosisRequestSchema>;

export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/** Taille maximale acceptée par `POST /uploads` (octets). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  kind: z.enum(IMAGE_KINDS).default('problem'),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const uploadResultSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(IMAGE_KINDS),
  bytes: z.number().int().nonnegative(),
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
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
  return rawDiagnosisSchema.parse(obj);
}
