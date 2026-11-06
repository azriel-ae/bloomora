import 'server-only';

import postgres from 'postgres';
import { supabaseDatabaseUrl } from '../env';

type SqlClient = ReturnType<typeof postgres>;
type SqlGlobal = typeof globalThis & { __bloomoraSupabaseSql?: SqlClient };

/**
 * Opens a small pooled PostgreSQL client for true multi-statement transactions.
 * Configure SUPABASE_DB_URL with the Supabase transaction/session pooler URI
 * suitable for the deployment environment. Do not use a direct REST sequence
 * for operations whose invariants depend on atomicity.
 */
export function createSupabaseDatabaseClient(): SqlClient | null {
  const url = supabaseDatabaseUrl();
  if (!url) return null;

  const runtime = globalThis as SqlGlobal;
  if (!runtime.__bloomoraSupabaseSql) {
    runtime.__bloomoraSupabaseSql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return runtime.__bloomoraSupabaseSql;
}
