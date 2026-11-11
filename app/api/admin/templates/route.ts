import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import {
  analyzeTemplateFiles,
  parseZip,
  validateFiles,
  validateManifestForAnalysis,
  type TemplateUploadFile,
} from '@/lib/server/dynamic-template-validation';
import { storageClient, uploadId } from '@/lib/server/dynamic-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function getUpload(request: Request) {
  const form = await request.formData();
  const upload = form.get('upload');
  if (!(upload instanceof File) || upload.size < 1) throw new Error('upload_required');
  const bytes = new Uint8Array(await upload.arrayBuffer());
  let files: TemplateUploadFile[];
  if (/\.zip$/i.test(upload.name)) files = parseZip(bytes);
  else if (/\.html?$/i.test(upload.name)) {
    files = validateFiles([{ path: upload.name, bytes, contentType: upload.type || 'text/html' }]).files;
  } else throw new Error('upload_must_be_html_or_zip');
  return { form, files };
}

function cleanErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : 'validation_failed';
  return message.split(':', 1)[0].slice(0, 80);
}
function publicErrorMessage(code: string, raw: string) {
  if (code === 'storage_upload') return 'File gagal disimpan ke Storage. Periksa konfigurasi Storage dan coba lagi.';
  if (code === 'database_insert') return /duplicate|unique/i.test(raw) ? 'Slug sudah digunakan. Ubah slug pada manifest lalu coba lagi.' : 'Metadata tidak dapat disimpan. Periksa migrasi database dan konfigurasi server.';
  if (code === 'server_not_configured') return 'Storage server belum dikonfigurasi.';
  return raw.slice(0, 220);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = storageClient();
  const { data, error } = await supabase.from('dynamic_templates').select('id,slug,name,description,category,renderer,status,version,entry_point,manifest,validation_errors,created_at,updated_at,published_at').order('updated_at', { ascending: false });
  if (error) return json({ ok: false, code: 'database_error' }, 500);
  return json({ ok: true, templates: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  try {
    const { form, files } = await getUpload(request);
    const { analysis, manifest: generatedManifest } = analyzeTemplateFiles(files);
    if (form.get('analyzeOnly') === 'true') return json({ ok: true, pipeline: ['uploaded', 'analyzing', 'manifest_generation', 'validating'], analysis, manifest: generatedManifest });
    if (analysis.errors.length) return json({ ok: false, code: analysis.errors[0], analysis }, 422);

    let manifest = generatedManifest;
    const manifestJson = form.get('manifestJson');
    if (typeof manifestJson === 'string' && manifestJson.trim()) {
      let edited: unknown;
      try { edited = JSON.parse(manifestJson); } catch { return json({ ok: false, code: 'manifest_invalid_json' }, 400); }
      manifest = validateManifestForAnalysis(edited, analysis, files);
    }

    const supabase = storageClient();
    const root = uploadId(manifest.slug, 1);
    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const path = `${root}/source/${file.path}`;
        const { error } = await supabase.storage.from('dynamic-templates').upload(path, file.bytes, { contentType: file.contentType, upsert: false });
        if (error) throw new Error(`storage_upload:${error.message}`);
        uploadedPaths.push(path);
      }
      const { data, error } = await supabase.from('dynamic_templates').insert({
        id: randomUUID(),
        slug: manifest.slug,
        name: manifest.name.id || manifest.name.en,
        description: manifest.description.id || manifest.description.en || '',
        category: manifest.category,
        renderer: manifest.renderer,
        version: manifest.version,
        entry_point: manifest.entryPoint,
        manifest,
        source_path: `${root}/source`,
        created_by: user.uid,
        status: 'ready_for_preview',
        validation_errors: [],
      }).select('id,slug,name,status,renderer,version,entry_point,manifest').single();
      if (error) throw new Error(`database_insert:${error.message}`);
      const isZip = (form.get('upload') as File).name.toLowerCase().endsWith('.zip');
      const pipeline = ['uploaded', ...(isZip ? ['extracting'] : []), 'analyzing', 'manifest_generation', 'validating', 'compatibility_check', 'preview_ready'];
      return json({ ok: true, template: data, analysis, pipeline });
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from('dynamic-templates').remove(uploadedPaths);
      throw error;
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'validation_failed';
    const code = cleanErrorCode(error);
    const status = code === 'storage_upload' || code === 'database_insert' || code === 'server_not_configured' ? 500 : 400;
    return json({ ok: false, code, message: publicErrorMessage(code, raw) }, status);
  }
}
