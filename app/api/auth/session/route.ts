import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'Supabase Auth is not configured in this environment.' }, { status: 503 });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'That sign-in session could not be verified.' }, { status: 401 });
  const { data: profile } = await client.from('admin_profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'owner' && profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const client = await createSupabaseServerClient();
  if (client) await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
