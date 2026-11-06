'use client';

import { createBrowserClient } from '@supabase/ssr';
import { hasSupabasePublicConfig, supabasePublicConfig } from '../env';

export function createSupabaseBrowserClient() {
  if (!hasSupabasePublicConfig()) return null;
  const { url, anonKey } = supabasePublicConfig();
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
