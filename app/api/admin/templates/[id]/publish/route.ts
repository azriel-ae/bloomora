import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.admin) return NextResponse.json({ ok: false, code: 'admin_required' }, { status: 403 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const { id } = await params;
  const { data: template, error: readError } = await supabase.from('dynamic_templates').select('id,status,renderer,entry_point,source_path,validation_errors').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ ok: false, code: 'database_error' }, { status: 500 });
  if (!template) return NextResponse.json({ ok: false, code: 'template_not_found' }, { status: 404 });
  if (template.status !== 'ready_for_preview') return NextResponse.json({ ok: false, code: 'template_not_ready' }, { status: 409 });
  if (template.renderer === 'custom-react') return NextResponse.json({ ok: false, code: 'react_build_worker_unavailable', message: 'Custom React/TSX membutuhkan build worker terisolasi sebelum dapat dipublikasikan.' }, { status: 409 });
  const { data, error } = await supabase.from('dynamic_templates').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id).eq('status', 'ready_for_preview').select('id,slug,status,published_at').single();
  if (error) return NextResponse.json({ ok: false, code: 'publish_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}
