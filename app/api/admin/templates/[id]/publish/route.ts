import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return json({ ok: false, code: 'server_not_configured' }, 503);
  const { id } = await params;
  const { data: template, error } = await supabase.from('dynamic_templates').select('id,status,renderer,manifest,validation_errors').eq('id', id).maybeSingle();
  if (error) return json({ ok: false, code: 'database_error' }, 500);
  if (!template) return json({ ok: false, code: 'template_not_found' }, 404);
  if (template.status !== 'ready_for_preview') return json({ ok: false, code: 'template_not_ready' }, 409);
  if ((template.validation_errors ?? []).length) return json({ ok: false, code: 'template_validation_failed' }, 409);

  // A previewable upload is not a customer-ready template. The current customer
  // registry accepts immutable TemplateConfig versions only; arbitrary HTML is
  // intentionally never inserted into that registry or published as a gift.
  const manifest = template.manifest as { compatibility?: { customerReady?: unknown } } | null;
  if (template.renderer !== 'native' || manifest?.compatibility?.customerReady !== true) {
    return json({ ok: false, code: 'customer_integration_unavailable', message: 'Template ini dapat dipreview oleh admin, tetapi belum terintegrasi dengan katalog, editor, entitlement, draft, revision, dan renderer customer Bloomora. Publikasi ditolak.' }, 409);
  }
  return json({ ok: false, code: 'customer_integration_unavailable', message: 'Dynamic native templates belum dapat dimuat oleh registry customer Bloomora. Publikasi ditolak sampai integrasi dan version pinning selesai.' }, 409);
}
