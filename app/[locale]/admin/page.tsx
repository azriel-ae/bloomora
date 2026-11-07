import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, Gift, ReceiptText, WalletCards } from 'lucide-react';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { getAdminOverview } from '@/lib/server/services';
import { formatRupiah } from '@/lib/i18n-core';
import { AuthCallout } from '@/components/auth-callout';
import { AdminTimeGreeting } from '@/components/admin/time-greeting';

export const metadata: Metadata = { title: 'Dasbor Admin', description: 'Ringkasan administrasi Bloomora.', robots: { index: false, follow: false } };
const statusLabel: Record<string, string> = { awaiting_payment: 'Menunggu pembayaran', proof_submitted: 'Perlu ditinjau', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' };
const statusClass: Record<string, string> = { awaiting_payment: 'bg-[#f7ead1] text-[#8b6a2b]', proof_submitted: 'bg-sage/30 text-moss', approved: 'bg-[#dfe9dc] text-moss', rejected: 'bg-[#f2dfd8] text-[#9d5d54]', cancelled: 'bg-ivory text-ink/50' };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.admin) return <div className="mx-auto max-w-3xl py-16"><AuthCallout title="Akses admin diperlukan" /></div>;
  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-3xl py-16"><div className="rounded-3xl border border-line bg-paper p-8"><h1 className="font-display text-3xl">Dasbor tidak tersedia</h1><p className="mt-3 text-sm leading-6 text-ink/60">Konfigurasi server Supabase diperlukan sebelum data admin dapat dimuat.</p></div></div>;
  const result = await getAdminOverview(env, { uid: user.uid, admin: true });
  if (!result.ok) return <div className="mx-auto max-w-3xl py-16"><p role="alert">Gagal memuat dasbor: {result.code}</p></div>;
  const stats = [
    { label: 'Jumlah transaksi', value: result.summary.transactions, icon: ReceiptText },
    { label: 'Pendapatan disetujui', value: formatRupiah(result.summary.revenueIdr, 'id'), icon: WalletCards },
    { label: 'Perlu ditindaklanjuti', value: result.summary.pending, icon: Clock3 },
    { label: 'Hadiah terbit', value: result.summary.publishedGifts, icon: Gift },
  ];
  return <div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Ringkasan</p><AdminTimeGreeting /><p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">Ringkasan hal yang perlu ditindaklanjuti hari ini. Pendapatan hanya mencakup pembayaran yang disetujui.</p></div><Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-semibold text-ivory hover:shadow-soft">Tinjau pesanan <ArrowUpRight size={16} /></Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-3xl border border-line bg-paper p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">{label}</p><span className="grid size-9 place-items-center rounded-xl bg-sage/20 text-moss"><Icon size={18} /></span></div><p className="mt-6 font-display text-3xl">{value}</p></div>)}</div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_.55fr]"><section className="rounded-3xl border border-line bg-paper"><div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6"><div><h2 className="font-display text-2xl">Transaksi terbaru</h2><p className="mt-1 text-sm text-ink/50">Aktivitas terbaru dari alur penjualan.</p></div><Link href="/admin/orders" className="text-sm font-semibold text-moss">Lihat semua</Link></div>{result.recentOrders.length === 0 ? <div className="px-6 py-14 text-center"><CreditCard className="mx-auto text-moss/50" /><p className="mt-3 text-sm text-ink/55">Belum ada transaksi.</p></div> : <div className="divide-y divide-line">{result.recentOrders.map((order) => <Link href={`/admin/orders/${encodeURIComponent(order.orderId)}`} key={order.orderId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-ivory sm:px-6"><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold">{order.orderId}</p><p className="mt-1 text-sm text-ink/55">{order.packageName} · {new Date(order.createdAtMs).toLocaleDateString('id-ID')}</p></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass[order.status] ?? 'bg-ivory text-ink/55'}`}>{statusLabel[order.status] ?? order.status}</span><span className="text-sm font-semibold">{formatRupiah(order.amountIdr, 'id')}</span></div></Link>)}</div>}</section>
      <section className="rounded-3xl border border-line bg-paper p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">Tautan cepat</p><h2 className="mt-3 font-display text-2xl">Kelola dengan mudah.</h2><div className="mt-6 space-y-3"><Link href="/admin/payment-methods" className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-4 text-sm font-semibold hover:bg-sage/20"><span className="flex items-center gap-3"><CreditCard size={18} className="text-moss" /> Metode pembayaran</span><ArrowUpRight size={16} /></Link><Link href="/admin/packages" className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-4 text-sm font-semibold hover:bg-sage/20"><span className="flex items-center gap-3"><CheckCircle2 size={18} className="text-moss" /> Pengaturan paket</span><ArrowUpRight size={16} /></Link></div></section>
    </div>
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
