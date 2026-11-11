import { NextResponse } from 'next/server';
import { verifyDynamicTemplatePreviewToken } from '@/lib/server/dynamic-template-preview-token';
import { safeTemplatePath } from '@/lib/server/dynamic-template-validation';
import { storageClient } from '@/lib/server/dynamic-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (status: number) => new NextResponse('Preview asset unavailable', { status, headers: { 'Cache-Control': 'private, no-store' } });
const mimeByExtension: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path } = await params;
  const [token, ...assetSegments] = path;
  if (!token || !verifyDynamicTemplatePreviewToken(id, token)) return fail(403);
  let safePath: string;
  try { safePath = safeTemplatePath(assetSegments.join('/')); } catch { return fail(404); }
  const supabase = storageClient();
  const { data: template, error: readError } = await supabase.from('dynamic_templates').select('source_path,renderer,status').eq('id', id).maybeSingle();
  if (readError || !template || template.renderer !== 'custom-html' || !['ready_for_preview', 'published'].includes(template.status) || !template.source_path) return fail(404);
  const { data, error: downloadError } = await supabase.storage.from('dynamic-templates').download(`${template.source_path}/${safePath}`);
  if (downloadError || !data) return fail(404);
  const extension = safePath.split('.').pop()?.toLowerCase() ?? '';
  const contentType = mimeByExtension[extension] ?? 'application/octet-stream';
  return new NextResponse(data, { headers: {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self';",
    'Cache-Control': 'private, no-store',
  } });
}
