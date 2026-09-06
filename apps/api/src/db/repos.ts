import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  FREE_MONTHLY_DIAGNOSES,
  type DiagnosisResult,
  type RepairCheck,
  type RepairGuide,
  type RepairSession,
  type RepairSessionStatus,
} from '@fixit/shared';
import type { Db } from './client';
import {
  appUsers,
  diagnoses,
  diagnosisImages,
  repairGuides,
  repairHistory,
  repairSessions,
} from './schema';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Crée le profil applicatif au premier appel, ou met l'email à jour.
 * `isAdmin` : `true`/`false` synchronise le rôle sur la liste `ADMIN_EMAILS` ;
 * `undefined` (email inconnu) laisse le rôle tel quel.
 */
export async function ensureUser(
  db: Db,
  id: string,
  email: string | null,
  isAdmin?: boolean,
): Promise<void> {
  const role = isAdmin === undefined ? undefined : isAdmin ? 'admin' : 'user';
  await db
    .insert(appUsers)
    .values({ id, email, role: role ?? 'user' })
    .onConflictDoUpdate({
      target: appUsers.id,
      set: {
        email: email ?? sql`${appUsers.email}`,
        ...(role ? { role } : {}),
      },
    });
}

export interface QuotaState {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
  role: string;
}

/** Un admin ou un abonné premium n'a aucune limite de diagnostics. */
function isUnlimited(plan: string, role: string): boolean {
  return role === 'admin' || plan === 'premium';
}

export async function getQuota(db: Db, userId: string): Promise<QuotaState> {
  const [u] = await db.select().from(appUsers).where(eq(appUsers.id, userId));
  const plan = u?.plan ?? 'free';
  const role = u?.role ?? 'user';
  const limit = isUnlimited(plan, role) ? Number.POSITIVE_INFINITY : FREE_MONTHLY_DIAGNOSES;
  if (!u) return { allowed: true, used: 0, limit, plan, role };
  const expired = Date.now() - new Date(u.periodStart).getTime() > PERIOD_MS;
  const used = expired ? 0 : u.diagnosesUsed;
  return { allowed: used < limit, used, limit, plan, role };
}

/** Vérifie puis consomme un crédit de diagnostic (jamais consommé pour un accès illimité). */
export async function consumeQuota(db: Db, userId: string): Promise<QuotaState> {
  const [u] = await db.select().from(appUsers).where(eq(appUsers.id, userId));
  const plan = u?.plan ?? 'free';
  const role = u?.role ?? 'user';
  const unlimited = isUnlimited(plan, role);
  const limit = unlimited ? Number.POSITIVE_INFINITY : FREE_MONTHLY_DIAGNOSES;
  const now = new Date();
  const expired = !u || now.getTime() - new Date(u.periodStart).getTime() > PERIOD_MS;
  const used = expired ? 0 : u.diagnosesUsed;

  if (used >= limit) return { allowed: false, used, limit, plan, role };

  if (!unlimited) {
    await db
      .update(appUsers)
      .set({ diagnosesUsed: used + 1, periodStart: expired ? now : u.periodStart })
      .where(eq(appUsers.id, userId));
  }

  return { allowed: true, used: unlimited ? used : used + 1, limit, plan, role };
}

export interface ImageMeta {
  r2Key: string;
  kind: string;
  contentType?: string | null;
  bytes?: number | null;
}

export async function insertDiagnosis(
  db: Db,
  userId: string,
  result: DiagnosisResult,
  aiProvider: string,
  aiModel: string,
  images: ImageMeta[],
): Promise<void> {
  const d = result.diagnosis;
  await db.insert(diagnoses).values({
    id: result.id,
    userId,
    category: result.category,
    brand: result.input.brand,
    model: result.input.model,
    userDescription: result.input.description,
    problem: d.problem,
    confidence: d.confidence,
    severity: d.severity,
    difficulty: d.difficulty,
    riskLevel: result.safety.riskLevel,
    recommendation: result.safety.recommendation,
    needsProfessional: d.needsProfessional,
    forcedStop: result.safety.forcedStop,
    repairabilityScore: result.repairability.score,
    repairabilityLabel: result.repairability.label,
    estimatedTimeMin: d.estimatedTimeMinutes ?? null,
    estimatedCostMin: d.estimatedCost?.min ?? null,
    estimatedCostMax: d.estimatedCost?.max ?? null,
    costCurrency: d.estimatedCost?.currency ?? null,
    rawDiagnosis: d,
    safety: result.safety,
    aiProvider,
    aiModel,
  });

  if (images.length > 0) {
    await db.insert(diagnosisImages).values(
      images.map((img) => ({
        diagnosisId: result.id,
        r2Key: img.r2Key,
        kind: img.kind,
        contentType: img.contentType ?? null,
        bytes: img.bytes ?? null,
      })),
    );
  }
}

export interface StoredDiagnosis extends DiagnosisResult {
  aiProvider: string;
  aiModel: string;
  status: string;
}

function rowToResult(
  row: typeof diagnoses.$inferSelect,
  imageIds: string[],
  videoIds: string[] = [],
): StoredDiagnosis {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt).toISOString(),
    category: (row.category as DiagnosisResult['category']) ?? null,
    input: {
      description: row.userDescription,
      brand: row.brand,
      model: row.model,
      imageIds,
      videoIds,
    },
    diagnosis: row.rawDiagnosis,
    safety: row.safety,
    repairability: { score: row.repairabilityScore, label: row.repairabilityLabel },
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    status: row.status,
  };
}

export async function getDiagnosis(
  db: Db,
  userId: string,
  id: string,
): Promise<StoredDiagnosis | null> {
  const [row] = await db
    .select()
    .from(diagnoses)
    .where(and(eq(diagnoses.id, id), eq(diagnoses.userId, userId)));
  if (!row) return null;
  const media = await db
    .select({ r2Key: diagnosisImages.r2Key, kind: diagnosisImages.kind })
    .from(diagnosisImages)
    .where(eq(diagnosisImages.diagnosisId, id));
  // `imageIds` / `videoIds` = l'id d'upload (suffixe de la clé `uploads/{id}`),
  // directement utilisable par `GET /uploads/:id`. (Pas l'id de ligne `diagnosis_images`.)
  const uploadId = (r2Key: string) => r2Key.split('/').pop() ?? r2Key;
  const imageIds = media.filter((m) => m.kind !== 'video').map((m) => uploadId(m.r2Key));
  const videoIds = media.filter((m) => m.kind === 'video').map((m) => uploadId(m.r2Key));
  return rowToResult(row, imageIds, videoIds);
}

/**
 * Diagnostics récents d'un utilisateur (fenêtre `sinceMs`), avec leurs `imageIds` /
 * `videoIds`. Sert à dédupliquer une requête identique (retour arrière, « Réessayer »
 * après un timeout client alors que le serveur a déjà répondu) sans rappeler Gemini.
 */
export async function recentDiagnoses(
  db: Db,
  userId: string,
  sinceMs: number,
): Promise<StoredDiagnosis[]> {
  const since = new Date(Date.now() - sinceMs);
  const rows = await db
    .select()
    .from(diagnoses)
    .where(and(eq(diagnoses.userId, userId), gt(diagnoses.createdAt, since)))
    .orderBy(desc(diagnoses.createdAt))
    .limit(20);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const media = await db
    .select({ diagnosisId: diagnosisImages.diagnosisId, r2Key: diagnosisImages.r2Key, kind: diagnosisImages.kind })
    .from(diagnosisImages)
    .where(inArray(diagnosisImages.diagnosisId, ids));
  const uploadId = (r2Key: string) => r2Key.split('/').pop() ?? r2Key;

  return rows.map((row) => {
    const mine = media.filter((m) => m.diagnosisId === row.id);
    return rowToResult(
      row,
      mine.filter((m) => m.kind !== 'video').map((m) => uploadId(m.r2Key)),
      mine.filter((m) => m.kind === 'video').map((m) => uploadId(m.r2Key)),
    );
  });
}

export interface DiagnosisListItem {
  id: string;
  createdAt: string;
  category: string | null;
  problem: string;
  recommendation: string;
  riskLevel: string;
  forcedStop: boolean;
  repairabilityScore: number;
  status: string;
}

export async function listDiagnoses(
  db: Db,
  userId: string,
  limit = 50,
): Promise<DiagnosisListItem[]> {
  const rows = await db
    .select()
    .from(diagnoses)
    .where(eq(diagnoses.userId, userId))
    .orderBy(desc(diagnoses.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.createdAt).toISOString(),
    category: r.category,
    problem: r.problem,
    recommendation: r.recommendation,
    riskLevel: r.riskLevel,
    forcedStop: r.forcedStop,
    repairabilityScore: r.repairabilityScore,
    status: r.status,
  }));
}

/** Renvoie les clés R2 des images liées (pour purge lors d'une suppression). */
export async function deleteDiagnosis(db: Db, userId: string, id: string): Promise<string[]> {
  const owned = await db
    .select({ id: diagnoses.id })
    .from(diagnoses)
    .where(and(eq(diagnoses.id, id), eq(diagnoses.userId, userId)));
  if (owned.length === 0) return [];

  const imgs = await db
    .select({ r2Key: diagnosisImages.r2Key })
    .from(diagnosisImages)
    .where(eq(diagnosisImages.diagnosisId, id));

  // Photos ajoutées pendant la réparation interactive (stockées dans checks[].imageId).
  const [session] = await db
    .select({ checks: repairSessions.checks })
    .from(repairSessions)
    .where(eq(repairSessions.diagnosisId, id));
  const stepKeys = (session?.checks ?? []).map((ch) => `uploads/${ch.imageId}`);

  await db.delete(diagnoses).where(eq(diagnoses.id, id)); // cascade images/guide/history/session
  return [...new Set([...imgs.map((i) => i.r2Key), ...stepKeys])];
}

export async function getRepairGuide(db: Db, diagnosisId: string): Promise<RepairGuide | null> {
  const [row] = await db
    .select()
    .from(repairGuides)
    .where(eq(repairGuides.diagnosisId, diagnosisId));
  return row?.data ?? null;
}

export async function saveRepairGuide(
  db: Db,
  diagnosisId: string,
  guide: RepairGuide,
  aiProvider: string,
  aiModel: string,
): Promise<void> {
  await db
    .insert(repairGuides)
    .values({ diagnosisId, data: guide, aiProvider, aiModel })
    .onConflictDoUpdate({ target: repairGuides.diagnosisId, set: { data: guide, aiProvider, aiModel } });
}

export interface HistoryEntry {
  id: string;
  outcome: string;
  feedbackWorked: boolean | null;
  feedbackNote: string | null;
  summary: string | null;
  beforeR2Key: string | null;
  afterR2Key: string | null;
  createdAt: string;
}

export async function addHistory(
  db: Db,
  userId: string,
  diagnosisId: string,
  entry: {
    outcome: string;
    feedbackWorked?: boolean | null;
    feedbackNote?: string | null;
    summary?: string | null;
    beforeR2Key?: string | null;
    afterR2Key?: string | null;
  },
): Promise<void> {
  await db.insert(repairHistory).values({ userId, diagnosisId, ...entry });
  const status =
    entry.outcome === 'fixed' ? 'fixed' : entry.outcome === 'pro' ? 'pro_recommended' : 'open';
  await db
    .update(diagnoses)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(diagnoses.id, diagnosisId), eq(diagnoses.userId, userId)));
}

/* --------------------------- Réparation interactive --------------------------- */

function rowToSession(row: typeof repairSessions.$inferSelect): RepairSession {
  return {
    id: row.id,
    diagnosisId: row.diagnosisId,
    status: row.status as RepairSessionStatus,
    currentStep: row.currentStep,
    stepCount: row.stepCount,
    checks: row.checks ?? [],
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function getRepairSession(
  db: Db,
  userId: string,
  diagnosisId: string,
): Promise<RepairSession | null> {
  const [row] = await db
    .select()
    .from(repairSessions)
    .where(and(eq(repairSessions.diagnosisId, diagnosisId), eq(repairSessions.userId, userId)));
  return row ? rowToSession(row) : null;
}

/** Crée la session si absente, sinon renvoie l'existante (ré-aligne `stepCount`). */
export async function ensureRepairSession(
  db: Db,
  userId: string,
  diagnosisId: string,
  stepCount: number,
): Promise<RepairSession> {
  const existing = await getRepairSession(db, userId, diagnosisId);
  if (existing) {
    if (existing.stepCount !== stepCount) {
      await db
        .update(repairSessions)
        .set({ stepCount, updatedAt: new Date() })
        .where(eq(repairSessions.id, existing.id));
      return { ...existing, stepCount };
    }
    return existing;
  }
  const [row] = await db
    .insert(repairSessions)
    .values({ diagnosisId, userId, stepCount, checks: [] })
    .returning();
  return rowToSession(row!);
}

/** Ajoute une vérification et fait avancer la session (autorité serveur). */
export async function recordRepairCheck(
  db: Db,
  sessionId: string,
  check: RepairCheck,
  nextStep: number,
  status: RepairSessionStatus,
): Promise<RepairSession> {
  const [row] = await db
    .update(repairSessions)
    .set({
      checks: sql`${repairSessions.checks} || ${JSON.stringify([check])}::jsonb`,
      currentStep: nextStep,
      status,
      updatedAt: new Date(),
    })
    .where(eq(repairSessions.id, sessionId))
    .returning();
  return rowToSession(row!);
}

export async function listHistory(
  db: Db,
  userId: string,
  diagnosisId: string,
): Promise<HistoryEntry[]> {
  const rows = await db
    .select()
    .from(repairHistory)
    .where(and(eq(repairHistory.diagnosisId, diagnosisId), eq(repairHistory.userId, userId)))
    .orderBy(desc(repairHistory.createdAt));
  return rows.map((r) => ({
    id: r.id,
    outcome: r.outcome,
    feedbackWorked: r.feedbackWorked,
    feedbackNote: r.feedbackNote,
    summary: r.summary,
    beforeR2Key: r.beforeR2Key,
    afterR2Key: r.afterR2Key,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}
