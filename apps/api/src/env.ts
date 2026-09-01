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

  // bindings
  IMAGES?: R2Bucket;
}
