import type { ObjectStorage } from './storage/types';

/** Bindings et variables d'environnement du Worker. */
export interface Env {
  // vars
  APP_ENV: string;
  FREE_MONTHLY_DIAGNOSES: string;
  GEMINI_MODEL: string;

  // secrets (via `wrangler secret put` / .dev.vars)
  GEMINI_API_KEY?: string;
  DATABASE_URL?: string;

  // Neon Auth (Stack) — publishable, pas secret, mais regroupé ici
  STACK_PROJECT_ID?: string;
  STACK_JWKS_URL?: string;
  STACK_PUBLISHABLE_KEY?: string;

  // Neon Object Storage (S3-compatible). Endpoint/bucket = vars, clés = secrets.
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;

  /** Stockage injecté par les tests (jamais défini en production). */
  STORAGE?: ObjectStorage;

  // Rate limiting (primitive native Cloudflare ; absent en local/tests -> pas de limite).
  DIAGNOSE_RL?: RateLimit;
  UPLOAD_RL?: RateLimit;
}
