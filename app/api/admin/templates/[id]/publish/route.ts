import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { DynamicTemplatePublishError, publishDynamicTemplateForAdmin } from '@/lib/server/dynamic-template-versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const { id } = await params;
  try {
    const snapshot = await publishDynamicTemplateForAdmin({ actor: { uid: user.uid, admin: true }, templateRowId: id });
    return json({
      ok: true,
      status: 'published',
      templateKey: snapshot.templateId,
      version: snapshot.version,
      publishedAt: snapshot.publishedAt,
      customerAvailable: false,
      message: 'Snapshot versi immutable tersimpan; template belum tersedia di katalog atau renderer customer.',
    });
  } catch (error) {
    if (error instanceof DynamicTemplatePublishError) {
      const messages: Record<string, string> = {
        dynamic_template_publish_migration_required: 'Migration snapshot dan atomic publish belum diterapkan di Supabase. Terapkan seluruh migration dynamic template hingga 20261111000400_dynamic_template_atomic_publish.sql.',
        template_not_ready: 'Template belum siap dipublikasikan. Jalankan analisis dan siapkan preview terlebih dahulu.',
        template_validation_failed: 'Validasi ulang bundle gagal. Periksa berkas dan hasil analisis sebelum mencoba lagi.',
        template_bundle_asset_mismatch: 'Isi Storage berbeda dari daftar aset pada manifest. Snapshot tidak dibuat.',
        template_publish_conflict: 'Lifecycle template berubah atau snapshot versi yang sama memiliki isi berbeda. Muat ulang sebelum mencoba lagi.',
        unsupported_template_renderer: 'Tahap ini hanya menerbitkan snapshot untuk renderer custom-html; customer runtime tetap belum tersedia.',
        template_storage_unavailable: 'Berkas privat tidak dapat dibaca ulang. Snapshot tidak dibuat dan status template tidak berubah.',
        template_manifest_invalid: 'Manifest tidak lolos validasi ulang terhadap berkas tersimpan.',
        template_source_path_invalid: 'Prefix Storage template tidak valid.',
        server_not_configured: 'Supabase server belum dikonfigurasi.',
      };
      return json({ ok: false, code: error.code, message: messages[error.code] ?? 'Snapshot tidak dibuat; lifecycle template tidak berubah.' }, error.status);
    }
    return json({ ok: false, code: 'template_publish_failed', message: 'Snapshot tidak dibuat. Periksa konfigurasi server dan coba lagi.' }, 500);
  }
}
