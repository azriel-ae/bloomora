import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCallout } from '@/components/auth-callout';
import { FeaturedDemoManager } from '@/components/admin/featured-demo-manager';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { getFeaturedDemoId } from '@/lib/server/featured-demo';

export const metadata: Metadata = { title: 'Pengaturan Demo Utama | Admin Bloomora', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function FeaturedDemoAdminPage() {
  const user = await getCurrentUser();
  if (!user || (user as { admin?: boolean }).admin !== true) return <AuthCallout title="Akses admin diperlukan" />;
  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-5xl py-12"><Link href="/admin" className="text-sm text-ink/55">Kembali ke dasbor</Link><h1 className="mt-6 font-display text-4xl">Featured Demo</h1><p className="mt-4 rounded-2xl border border-line bg-paper p-5">Database server belum dikonfigurasi. Pengaturan tidak disimpan di browser.</p></div>;
  const initialTemplateId = await getFeaturedDemoId(env);
  return <div className="mx-auto max-w-7xl py-8 sm:py-12"><Link href="/admin" className="text-sm text-ink/55">Kembali ke dasbor</Link><p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-moss">Pengaturan situs publik</p><h1 className="mt-3 font-display text-5xl">Atur halaman Demo utama</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-ink/60">Pilih template di daftar, periksa pratinjaunya, lalu tekan tombol simpan. Perubahan di daftar hanya mengubah pratinjau; halaman Demo publik dan menu Demo baru berubah setelah pilihan disimpan.</p><FeaturedDemoManager initialTemplateId={initialTemplateId} /></div>;
}
