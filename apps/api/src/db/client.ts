import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Env } from '../env';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Client Drizzle sur Neon (HTTP, compatible Workers). */
export function getDb(env: Env): Db {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export { schema };
