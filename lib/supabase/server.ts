import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hasSupabasePublicConfig, supabasePublicConfig } from '../env';

/**
 * Creates the request-scoped Supabase client used to establish and verify Auth
 * sessions. Authorization decisions must call auth.getUser() and check the
 * server-controlled admin role; never trust client-provided user metadata.
 */
export async function createSupabaseServerClient() {
  if (!hasSupabasePublicConfig()) return null;
  const { url, anonKey } = supabasePublicConfig();
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components may not have a writable cookie store. Middleware
          // and route handlers perform refresh writes when the request is mutable.
        }
      },
    },
  });
}
