import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Usage = { gifts: number; activeGifts: number; drafts: number; publicGifts: number; publishedRevisions: number; files: number; total: number; canDeletePermanently: boolean };
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function usageFor(supabase: ReturnType<typeof createSupabaseAdminClient> extends infer T ? NonNullable<T> : never, id: string, slug: string, sourcePath: string | null): Promise<Usage> {
  const [gifts, revisions, publicGifts] = await Promise.all([
    supabase.from('gifts').select('template_id,status').or(`template_id.eq.${id},template_id.eq.${slug}`),
    supabase.from('gift_revisions').select('template_id,template_version').or(`template_id.eq.${id},template_id.eq.${slug}`),
    supabase.from('public_gifts').select('template_id,status').or(`template_id.eq.${id},template_id.eq.${slug}`),
  ]);
  const giftRows = gifts.data ?? [];
  const revisionRows = revisions.data ?? [];
  const publicRows = publicGifts.data ?? [];
  const activeGifts = giftRows.filter((row) => ['draft', 'published'].includes(row.status)).length;
  const publishedRevisions = revisionRows.length;
  const publicCount = publicRows.filter((row) => row.status === 'published').length;
  // Storage references are counted from metadata paths, not from client-supplied values.
  let files = 0;
  if (sourcePath) { const { data } = await supabase.storage.from('dynamic-templates').list(sourcePath, { limit: 1000 }); files = data?.length ?? 0; }
  const total = giftRows.length + publishedRevisions + publicRows.length + files;
  return { gifts: giftRows.length, activeGifts, drafts: giftRows.filter((row) => row.status === 'draft').length, publicGifts: publicCount, publishedRevisions, files, total, canDeletePermanently: total === 0 };
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = createSupabaseAdminClient(); if (!supabase) return json({ ok: false, code: 'server_not_configured' }, 503);
  const { id } = await params; const { data: template } = await supabase.from('dynamic_templates').select('id,slug,name,status,source_path').eq('id', id).maybeSingle();
  if (!template) return json({ ok: false, code: 'template_not_found' }, 404);
  return json({ ok: true, usage: await usageFor(supabase, template.id, template.slug, template.source_path) });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = createSupabaseAdminClient(); if (!supabase) return json({ ok: false, code: 'server_not_configured' }, 503);
  const { id } = await params; const body = await request.json().catch(() => ({})); const action = body.action;
  if (!['archive', 'restore'].includes(action)) return json({ ok: false, code: 'invalid_action' }, 400);
  const { data: template } = await supabase.from('dynamic_templates').select('id,slug,name,status,source_path').eq('id', id).maybeSingle();
  if (!template) return json({ ok: false, code: 'template_not_found' }, 404);
  if (action === 'archive' && template.status !== 'archived') {
    const usage = await usageFor(supabase, template.id, template.slug, template.source_path);
    const nextStatus = usage.total > 0 ? 'archived' : 'archived';
    const { error } = await supabase.from('dynamic_templates').update({ status: nextStatus }).eq('id', id);
    if (error) return json({ ok: false, code: 'archive_failed' }, 500);
    await supabase.from('admin_audit_logs').insert({ id: `template_archive_${id}_${Date.now()}`, actor_uid: user.uid, action: 'archive_template', entity_type: 'dynamic_template', entity_id: id, details: { usage } });
    return json({ ok: true, status: 'archived', usage });
  }
  if (action === 'restore' && template.status === 'archived') {
    const { error } = await supabase.from('dynamic_templates').update({ status: 'ready_for_preview' }).eq('id', id).eq('status', 'archived');
    if (error) return json({ ok: false, code: 'restore_failed' }, 500);
    await supabase.from('admin_audit_logs').insert({ id: `template_restore_${id}_${Date.now()}`, actor_uid: user.uid, action: 'restore_template', entity_type: 'dynamic_template', entity_id: id, details: {} });
    return json({ ok: true, status: 'ready_for_preview' });
  }
  return json({ ok: false, code: 'invalid_status_transition' }, 409);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = createSupabaseAdminClient(); if (!supabase) return json({ ok: false, code: 'server_not_configured' }, 503);
  const { id } = await params; const { data: template } = await supabase.from('dynamic_templates').select('id,slug,name,status,source_path,build_path,thumbnail_path').eq('id', id).maybeSingle();
  if (!template) return json({ ok: false, code: 'template_not_found' }, 404);
  const usage = await usageFor(supabase, template.id, template.slug, template.source_path);
  if (!usage.canDeletePermanently) return json({ ok: false, code: 'template_in_use', message: 'Template masih digunakan; gunakan arsip.', usage }, 409);
  const paths: string[] = [];
  for (const prefix of [template.source_path, template.build_path, template.thumbnail_path]) { if (!prefix) continue; const { data } = await supabase.storage.from('dynamic-templates').list(prefix, { limit: 1000 }); for (const item of data ?? []) paths.push(`${prefix}/${item.name}`); }
  if (paths.length) { const { error } = await supabase.storage.from('dynamic-templates').remove(paths); if (error) return json({ ok: false, code: 'storage_delete_failed', message: error.message }, 500); }
  const { error } = await supabase.from('dynamic_templates').delete().eq('id', id);
  if (error) return json({ ok: false, code: 'database_delete_failed', message: 'Metadata tidak dihapus karena penghapusan database gagal.' }, 500);
  await supabase.from('admin_audit_logs').insert({ id: `template_delete_${id}_${Date.now()}`, actor_uid: user.uid, action: 'delete_template', entity_type: 'dynamic_template', entity_id: id, details: { usage, removedFiles: paths.length } });
  return json({ ok: true, deleted: id });
}
