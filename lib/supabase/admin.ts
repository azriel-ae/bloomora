import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { hasSupabaseServiceRoleConfig, supabasePublicConfig, supabaseServiceRoleKey } from '../env';

/**
 * Server-only privileged client. Use only after route/service authorization;
 * its key bypasses RLS and must never be imported by browser code or returned.
 */
export function createSupabaseAdminClient() {
  if (!hasSupabaseServiceRoleConfig()) return null;
  const { url } = supabasePublicConfig();
  const key = supabaseServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
