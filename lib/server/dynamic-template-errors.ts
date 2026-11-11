export type DynamicTemplateDbFailure = { code: string; message: string; status: number };

type SupabaseDbError = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null | undefined;

export function classifyDynamicTemplateDatabaseError(error: SupabaseDbError): DynamicTemplateDbFailure {
  const postgresCode = typeof error?.code === 'string' ? error.code : '';
  if (postgresCode === '42P01' || postgresCode === 'PGRST205') {
    return { code: 'dynamic_template_migration_required', message: 'Tabel dynamic_templates belum tersedia. Jalankan berurutan migration 20261110000100_dynamic_templates.sql, 20261110000200_dynamic_template_lifecycle.sql, dan 20261111000100_dynamic_template_asset_mime.sql di Supabase.', status: 503 };
  }
  if (postgresCode === '42703' || postgresCode === 'PGRST204') {
    return { code: 'dynamic_template_migration_outdated', message: 'Skema tabel dynamic_templates belum sesuai versi aplikasi. Periksa dan terapkan seluruh migration dynamic-template di Supabase.', status: 503 };
  }
  if (postgresCode === '23505') {
    return { code: 'duplicate_slug', message: 'Slug template sudah digunakan. Ubah slug pada manifest, lalu coba lagi.', status: 409 };
  }
  if (postgresCode === '23503') {
    return { code: 'admin_user_reference_invalid', message: 'Akun admin tidak cocok dengan referensi pengguna Supabase. Periksa sesi admin dan auth.users.', status: 400 };
  }
  if (postgresCode === '23514' || postgresCode === '22P02' || postgresCode === '22001') {
    return { code: 'dynamic_template_metadata_invalid', message: 'Metadata ditolak oleh aturan tabel Supabase. Periksa nama, slug, kategori, renderer, versi, dan migration yang terpasang.', status: 400 };
  }
  if (postgresCode === '42501' || postgresCode === 'PGRST301') {
    return { code: 'dynamic_template_database_permission', message: 'Supabase menolak akses database. Periksa SUPABASE_SERVICE_ROLE_KEY pada deployment dan privilege service_role.', status: 503 };
  }
  return { code: 'dynamic_template_database_error', message: `Metadata template gagal disimpan (kode database: ${postgresCode || 'tidak tersedia'}). Periksa log server untuk detail aman.`, status: 500 };
}
