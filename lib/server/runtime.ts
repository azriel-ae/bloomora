import { hasSupabaseDatabaseConfig } from '../env';
import { createSupabaseDatabaseClient } from '../supabase/database';
import { postgresStore } from './postgres-store';
import type { Env } from './store';

/** Builds the production Env from Supabase's transaction-capable PostgreSQL connection. */
export function getServerEnv(): Env | null {
  if (!hasSupabaseDatabaseConfig()) return null;
  const database = createSupabaseDatabaseClient();
  if (!database) return null;
  return {
    store: postgresStore(database),
    nowMs: () => Date.now(),
    ts: (ms) => ({ toMillis: () => ms }),
    newId: () => crypto.randomUUID(),
  };
}
