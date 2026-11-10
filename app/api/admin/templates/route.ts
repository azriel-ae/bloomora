import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { storageClient, parseManifest, parseZip, validateFiles, uploadId, type TemplateUploadFile } from '@/lib/server/dynamic-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = storageClient();
  const { data, error } = await supabase.from('dynamic_templates').select('id,slug,name,description,category,renderer,status,version,entry_point,validation_errors,created_at,updated_at,published_at').order('updated_at', { ascending: false });
  if (error) return json({ ok: false, code: 'database_error' }, 500);
  return json({ ok: true, templates: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const form = await request.formData();
  const slug = String(form.get('slug') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const category = String(form.get('category') ?? '').trim();
  const renderer = String(form.get('renderer') ?? '').trim();
  const version = Number(form.get('version') ?? 1);
  const zip = form.get('zip');
  const files: TemplateUploadFile[] = [];
  try {
    if (zip instanceof File && zip.size > 0) files.push(...parseZip(new Uint8Array(await zip.arrayBuffer())));
    else {
      const rawFiles = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
      for (const file of rawFiles) files.push({ path: file.name, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type || 'application/octet-stream' });
      validateFiles(files);
    }
    const manifest = parseManifest(files);
    if (manifest.slug && manifest.slug !== slug) throw new Error('slug_manifest_mismatch');
    if (manifest.renderer !== renderer) throw new Error('renderer_manifest_mismatch');
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('invalid_slug');
    if (!name || name.length > 120 || !category || !['native', 'custom-html', 'custom-react'].includes(renderer)) throw new Error('invalid_metadata');
    if (!Number.isInteger(version) || version < 1) throw new Error('invalid_version');
    const supabase = storageClient();
    const root = uploadId(slug, version);
    for (const file of files) { const { error } = await supabase.storage.from('dynamic-templates').upload(`${root}/source/${file.path}`, file.bytes, { contentType: file.contentType, upsert: false }); if (error) throw new Error(`storage_upload:${error.message}`); }
    const { data, error } = await supabase.from('dynamic_templates').insert({ slug, name, description, category, renderer, version, entry_point: manifest.entryPoint, manifest, source_path: `${root}/source`, created_by: user.uid, status: 'ready_for_preview', validation_errors: [] }).select('id,slug,name,status,renderer,version,entry_point').single();
    if (error) throw new Error(`database_insert:${error.message}`);
    return json({ ok: true, template: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'validation_failed';
    return json({ ok: false, code: 'validation_failed', message }, 400);
  }
}
