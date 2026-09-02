import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { RawDiagnosis, RepairCheck, RepairGuide, SafetyResult } from '@fixit/shared';

/** Profil applicatif, clé = id utilisateur Neon Auth (Stack `sub`). */
export const appUsers = pgTable('app_users', {
  id: text('id').primaryKey(),
  email: text('email'),
  plan: text('plan').notNull().default('free'),
  /** 'user' (défaut) ou 'admin' — un admin a un accès illimité, quota jamais consommé. */
  role: text('role').notNull().default('user'),
  diagnosesUsed: integer('diagnoses_used').notNull().default(0),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const diagnoses = pgTable(
  'diagnoses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    category: text('category'),
    brand: text('brand'),
    model: text('model'),
    serialNumber: text('serial_number'),
    userDescription: text('user_description').notNull().default(''),
    problem: text('problem').notNull(),
    confidence: real('confidence').notNull(),
    severity: text('severity').notNull(),
    difficulty: text('difficulty').notNull(),
    riskLevel: text('risk_level').notNull(),
    recommendation: text('recommendation').notNull(),
    needsProfessional: boolean('needs_professional').notNull(),
    forcedStop: boolean('forced_stop').notNull(),
    repairabilityScore: integer('repairability_score').notNull(),
    repairabilityLabel: text('repairability_label').notNull(),
    estimatedTimeMin: integer('estimated_time_min'),
    estimatedCostMin: real('estimated_cost_min'),
    estimatedCostMax: real('estimated_cost_max'),
    costCurrency: text('cost_currency'),
    rawDiagnosis: jsonb('raw_diagnosis').$type<RawDiagnosis>().notNull(),
    safety: jsonb('safety').$type<SafetyResult>().notNull(),
    aiProvider: text('ai_provider').notNull(),
    aiModel: text('ai_model').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('diagnoses_user_created_idx').on(t.userId, t.createdAt.desc())],
);

export const diagnosisImages = pgTable('diagnosis_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  diagnosisId: uuid('diagnosis_id')
    .notNull()
    .references(() => diagnoses.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  kind: text('kind').notNull().default('problem'),
  contentType: text('content_type'),
  bytes: integer('bytes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repairGuides = pgTable('repair_guides', {
  diagnosisId: uuid('diagnosis_id')
    .primaryKey()
    .references(() => diagnoses.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<RepairGuide>().notNull(),
  aiProvider: text('ai_provider').notNull(),
  aiModel: text('ai_model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repairHistory = pgTable('repair_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  diagnosisId: uuid('diagnosis_id')
    .notNull()
    .references(() => diagnoses.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  beforeR2Key: text('before_r2_key'),
  afterR2Key: text('after_r2_key'),
  feedbackWorked: boolean('feedback_worked'),
  feedbackNote: text('feedback_note'),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Réparation interactive : une session par diagnostic, avec l'historique des vérifications. */
export const repairSessions = pgTable('repair_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  diagnosisId: uuid('diagnosis_id')
    .notNull()
    .unique()
    .references(() => diagnoses.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  currentStep: integer('current_step').notNull().default(0),
  stepCount: integer('step_count').notNull().default(0),
  checks: jsonb('checks').$type<RepairCheck[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const CURRENT_TIMESTAMP = sql`now()`;
