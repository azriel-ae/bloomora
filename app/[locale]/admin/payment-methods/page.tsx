import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCallout } from '@/components/auth-callout';
import { PaymentMethodsManager } from '@/components/admin/payment-methods-manager';
import { getLocale, getMessages } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/session';
import { listAdminPaymentMethods } from '@/lib/server/services';
import { getServerEnv } from '@/lib/server/runtime';

export const metadata: Metadata = { title: 'Metode Pembayaran | Admin Bloomora', robots: { index: false, follow: false } };

export default async function AdminPaymentMethodsPage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const messages = getMessages(locale);
  const copy = { ...messages.admin.paymentMethods, intro: 'Kelola metode pembayaran yang dapat dipilih pelanggan. Hanya metode aktif yang ditampilkan saat pembayaran; setiap pesanan akan divalidasi ulang oleh server.', empty: 'Belum ada metode pembayaran. Tambahkan metode sebelum pelanggan dapat membuat pesanan.', note: 'Urutan metode baru diatur otomatis oleh server. QRIS harus lulus validasi payload dan hasil crop sebelum dapat diaktifkan.', eWallet: 'Dompet elektronik' };
  if (!user) return <div className="mx-auto max-w-3xl px-5 py-20"><AuthCallout title={messages.admin.gated} /></div>;

  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-5xl px-5 py-14"><Link href="/admin" className="text-sm text-ink/55">{messages.adminSection.back}</Link><h1 className="mt-8 font-display text-4xl">{copy.title}</h1><p className="mt-4 rounded-2xl border border-line bg-paper p-5 text-sm">Konfigurasi server Supabase diperlukan untuk memuat atau menyimpan metode pembayaran.</p></div>;

  const result = await listAdminPaymentMethods(env, { uid: user.uid, admin: user.admin });
  if (!result.ok) return <div className="mx-auto max-w-5xl px-5 py-14"><p role="alert">Gagal memuat metode pembayaran: {result.code}</p></div>;
  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
    <Link href="/admin" className="text-sm text-ink/55">{messages.adminSection.back}</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.admin.eyebrow}</p>
    <h1 className="mt-3 font-display text-5xl">{copy.title}</h1>
    <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/60">{copy.intro}</p>
    <PaymentMethodsManager initialMethods={result.methods} initialQrisDisplay={result.qrisDisplay} copy={copy} />
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
