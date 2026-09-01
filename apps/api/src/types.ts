import type { Env } from './env';

export interface AuthedVars {
  userId: string;
  userEmail: string | null;
}

export type AppEnv = { Bindings: Env; Variables: AuthedVars };
