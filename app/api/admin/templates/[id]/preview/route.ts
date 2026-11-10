import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.admin) return new NextResponse('Admin required', { status: 403 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return new NextResponse('Server not configured', { status: 503 });
  const { id } = await params;
  const { data: template } = await supabase.from('dynamic_templates').select('entry_point,source_path,renderer,status').eq('id', id).maybeSingle();
  if (!template || !['ready_for_preview', 'published'].includes(template.status)) return new NextResponse('Preview unavailable', { status: 404 });
  if (template.renderer !== 'custom-html') return new NextResponse('Only custom HTML has a direct iframe preview', { status: 409 });
  const { data, error } = await supabase.storage.from('dynamic-templates').download(`${template.source_path}/${template.entry_point}`);
  if (error || !data) return new NextResponse('Entry point unavailable', { status: 404 });
  const html = await data.text();
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src 'none'; frame-ancestors 'self';", 'Cache-Control': 'no-store' } });
}
