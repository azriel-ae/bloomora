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
  if (gifts.error || revisions.error || publicGifts.error) throw new Error('usage_query_failed');
  const giftRows = gifts.data ?? [];
  const revisionRows = revisions.data ?? [];
  const publicRows = publicGifts.data ?? [];
  const activeGifts = giftRows.filter((row) => ['draft', 'published'].includes(row.status)).length;
  const publishedRevisions = revisionRows.length;
  const publicCount = publicRows.filter((row) => row.status === 'published').length;
  // Storage references are counted from metadata paths, not from client-supplied values.
  let files = 0;
  async function countFiles(prefix: string): Promise<number> {
    let count = 0; let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage.from('dynamic-templates').list(prefix, { limit: 1000, offset });
      if (error) throw new Error('storage_list_failed');
      const items = data ?? [];
      for (const item of items) count += item.id ? 1 : await countFiles(`${prefix}/${item.name}`);
      if (items.length < 1000) return count;
      offset += items.length;
    }
  }
  if (sourcePath) files = await countFiles(sourcePath);
  const references = giftRows.length + publishedRevisions + publicRows.length;
  return { gifts: giftRows.length, activeGifts, drafts: giftRows.filter((row) => row.status === 'draft').length, publicGifts: publicCount, publishedRevisions, files, total: references + files, canDeletePermanently: references === 0 };
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = createSupabaseAdminClient(); if (!supabase) return json({ ok: false, code: 'server_not_configured' }, 503);
  const { id } = await params; const { data: template } = await supabase.from('dynamic_templates').select('id,slug,name,status,source_path').eq('id', id).maybeSingle();
  if (!template) return json({ ok: false, code: 'template_not_found' }, 404);
  try { return json({ ok: true, usage: await usageFor(supabase, template.id, template.slug, template.source_path) }); }
  catch { return json({ ok: false, code: 'usage_check_failed', message: 'Relasi dan file template gagal diverifikasi. Tidak ada penghapusan yang diizinkan.' }, 503); }
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
  if (!['draft', 'ready_for_preview', 'validation_failed'].includes(template.status)) return json({ ok: false, code: 'draft_delete_only', message: 'Hanya template Draft yang boleh dihapus. Template yang pernah dipublikasikan harus diarsipkan.' }, 409);
  let usage: Usage;
  try { usage = await usageFor(supabase, template.id, template.slug, template.source_path); }
  catch { return json({ ok: false, code: 'usage_check_failed', message: 'Relasi dan file template gagal diverifikasi. Tidak ada penghapusan yang diizinkan.' }, 503); }
  if (!usage.canDeletePermanently) return json({ ok: false, code: 'template_in_use', message: 'Template masih digunakan; gunakan arsip.', usage }, 409);
  const templateStorage = supabase.storage.from('dynamic-templates');
  const paths: string[] = [];
  async function collectFiles(prefix: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await templateStorage.list(prefix, { limit: 1000, offset });
      if (error) throw new Error('storage_list_failed');
      const items = data ?? [];
      for (const item of items) {
        const path = `${prefix}/${item.name}`;
        if (item.id) paths.push(path);
        else await collectFiles(path);
      }
      if (items.length < 1000) return;
      offset += items.length;
    }
  }
  try { for (const prefix of [template.source_path, template.build_path, template.thumbnail_path]) if (prefix) await collectFiles(prefix); }
  catch { return json({ ok: false, code: 'storage_list_failed', message: 'Daftar file template gagal diperiksa; tidak ada metadata atau file yang dihapus.' }, 500); }
  if (paths.length) { const { error } = await templateStorage.remove(paths); if (error) return json({ ok: false, code: 'storage_delete_failed', message: error.message }, 500); }
  const { error } = await supabase.from('dynamic_templates').delete().eq('id', id);
  if (error) return json({ ok: false, code: 'database_delete_failed', message: 'Metadata tidak dihapus karena penghapusan database gagal.' }, 500);
  await supabase.from('admin_audit_logs').insert({ id: `template_delete_${id}_${Date.now()}`, actor_uid: user.uid, action: 'delete_template', entity_type: 'dynamic_template', entity_id: id, details: { usage, removedFiles: paths.length } });
  return json({ ok: true, deleted: id });
}
