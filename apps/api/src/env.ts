/** Bindings et variables d'environnement du Worker. */
export interface Env {
  // vars
  APP_ENV: string;
  FREE_MONTHLY_DIAGNOSES: string;
  GEMINI_MODEL: string;

  // secrets (via `wrangler secret put` / .dev.vars) — optionnels tant que PHASE 4/6 pas faites
  GEMINI_API_KEY?: string;
  DATABASE_URL?: string;
  AUTH_JWT_SECRET?: string;

  // bindings
  IMAGES?: R2Bucket;
}
