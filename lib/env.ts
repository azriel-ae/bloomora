export function supabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null,
  };
}

export function hasSupabasePublicConfig() {
  const { url, anonKey } = supabasePublicConfig();
  if (!url || !anonKey) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.host);
  } catch {
    return false;
  }
}

/** Privileged key is intentionally server-only; never read it in client components. */
export function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function hasSupabaseServiceRoleConfig() {
  return hasSupabasePublicConfig() && Boolean(supabaseServiceRoleKey());
}

/** PostgreSQL URI used only for real transaction-capable server persistence. */
export function supabaseDatabaseUrl() {
  const value = process.env.SUPABASE_DB_URL?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:' ? value : null;
  } catch {
    return null;
  }
}

export function hasSupabaseDatabaseConfig() {
  return Boolean(supabaseDatabaseUrl());
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}
