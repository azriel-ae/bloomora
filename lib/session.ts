import { cache } from 'react';
import { createSupabaseServerClient } from './supabase/server';

export const getCurrentUser = cache(async function getCurrentUser() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await client.from('admin_profiles').select('role').eq('user_id', user.id).maybeSingle();
  return { uid: user.id, email: user.email ?? null, admin: profile?.role === 'owner' || profile?.role === 'admin' };
});
