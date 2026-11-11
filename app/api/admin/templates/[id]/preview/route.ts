import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createDynamicTemplatePreviewToken } from '@/lib/server/dynamic-template-preview-token';
import { storageClient } from '@/lib/server/dynamic-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const error = (message: string, status: number) => new NextResponse(message, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.admin) return error('Admin required', 403);
  const { id } = await params;
  const supabase = storageClient();
  const { data: template, error: readError } = await supabase.from('dynamic_templates').select('entry_point,source_path,renderer,status').eq('id', id).maybeSingle();
  if (readError) return error('Preview unavailable', 503);
  if (!template || !['ready_for_preview', 'published'].includes(template.status)) return error('Preview unavailable', 404);
  if (template.renderer !== 'custom-html' || !template.entry_point || !template.source_path) return error('Only analyzed HTML templates can be previewed', 409);
  const { data, error: downloadError } = await supabase.storage.from('dynamic-templates').download(`${template.source_path}/${template.entry_point}`);
  if (downloadError || !data) return error('Entry point unavailable', 404);
  let html = await data.text();
  const token = createDynamicTemplatePreviewToken(id);
  const previewRoot = `/api/admin/templates/${encodeURIComponent(id)}/preview/${token}/`;
  const parentPath = template.entry_point.includes('/') ? `${template.entry_point.slice(0, template.entry_point.lastIndexOf('/') + 1)}` : '';
  const parentBase = `${previewRoot}${parentPath}`;
  html = html.replace(/<base\b[^>]*>/gi, '').replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])refresh\1[^>]*>/gi, '').replace(/<meta\b[^>]*\bname\s*=\s*(["'])viewport\1[^>]*>/gi, '');
  html = html.replace(/(<(?:img|script|link|source|video|audio|track|input)\b[^>]*?\b(?:src|href|poster)\s*=\s*)(["'])\/(?!\/)([^"']*)/gi, (_match, before: string, quote: string, path: string) => `${before}${quote}${previewRoot}${path}${quote}`);
  const origin = new URL(request.url).origin;
  const baseTag = `<base href="${parentBase}">`;
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${baseTag}${viewportTag}`);
  else html = `<!doctype html><html><head>${baseTag}${viewportTag}<meta charset="utf-8"></head><body>${html}</body></html>`;
  return new NextResponse(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'none'; base-uri ${origin}; style-src 'self' ${origin} 'unsafe-inline'; script-src 'self' ${origin} 'unsafe-inline'; img-src 'self' ${origin} data: blob:; font-src 'self' ${origin} data:; media-src 'self' ${origin} data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; object-src 'none';`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-store',
  } });
}
