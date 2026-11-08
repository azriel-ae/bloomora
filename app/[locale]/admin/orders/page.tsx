import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { listAdminOrders } from '@/lib/server/services';
import { formatRupiah } from '@/lib/i18n-core';

export const metadata: Metadata = { title: 'Penjualan dan Transaksi', description: 'Dasbor transaksi Bloomora yang dibatasi.', robots: { index: false, follow: false } };

function label(status: string) {
  return ({ awaiting_payment: 'Menunggu pembayaran', proof_submitted: 'Menunggu verifikasi', approved: 'Pembayaran berhasil', rejected: 'Pembayaran ditolak', cancelled: 'Dibatalkan' } as Record<string, string>)[status] ?? status;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; packageId?: string; search?: string }> }) {
  const user = await getCurrentUser();
  const isAdmin = Boolean(user && (user as { admin?: boolean }).admin);
  if (!isAdmin) return <div className="mx-auto max-w-3xl px-5 py-20"><div className="rounded-3xl border border-line bg-paper p-8"><h1 className="font-display text-3xl">Akses admin diperlukan</h1><p className="mt-3 text-sm text-ink/60">Masuk melalui halaman admin untuk melihat data penjualan.</p><Link href="/admin/login" className="mt-6 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">Masuk Admin</Link></div></div>;
  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-3xl px-5 py-20"><div className="rounded-3xl border border-line bg-paper p-8"><h1 className="font-display text-3xl">Data penjualan tidak tersedia</h1><p className="mt-3 text-sm text-ink/60">Konfigurasi server Supabase diperlukan sebelum data transaksi dapat dimuat.</p></div></div>;
  const filters = await searchParams;
  const result = await listAdminOrders(env, { uid: user!.uid, admin: true }, filters);
  if (!result.ok) return <div className="mx-auto max-w-3xl px-5 py-20"><p role="alert">Gagal memuat data penjualan: {result.code}</p></div>;

  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
    <Link href="/admin" className="text-sm text-ink/55">← Dasbor Admin</Link>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Penjualan / transaksi</p><h1 className="mt-3 font-display text-5xl">Ringkasan penjualan</h1><p className="mt-3 text-sm text-ink/60">Pendapatan hanya menghitung transaksi dengan pembayaran yang disetujui admin.</p></div><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl border border-line bg-paper px-4 py-3"><p className="text-xs text-ink/50">Transaksi</p><p className="mt-1 text-xl font-semibold">{result.summary.count}</p></div><div className="rounded-2xl border border-line bg-paper px-4 py-3"><p className="text-xs text-ink/50">Berhasil</p><p className="mt-1 text-xl font-semibold">{result.summary.successful}</p></div><div className="rounded-2xl border border-line bg-paper px-4 py-3"><p className="text-xs text-ink/50">Pendapatan</p><p className="mt-1 text-xl font-semibold">{formatRupiah(result.summary.revenueIdr, 'id')}</p></div></div></div>
    <form className="mt-8 flex flex-wrap gap-3 rounded-3xl border border-line bg-paper p-4"><input name="search" defaultValue={filters.search} placeholder="Cari nomor transaksi, email, atau WhatsApp" className="min-w-64 flex-1 rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /><select name="status" defaultValue={filters.status ?? ''} className="rounded-xl border border-line bg-ivory px-4 py-3 text-sm"><option value="">Semua status</option><option value="awaiting_payment">Menunggu pembayaran</option><option value="proof_submitted">Menunggu verifikasi</option><option value="approved">Berhasil</option><option value="rejected">Ditolak</option><option value="cancelled">Dibatalkan</option></select><select name="packageId" defaultValue={filters.packageId ?? ''} className="rounded-xl border border-line bg-ivory px-4 py-3 text-sm"><option value="">Semua paket</option><option value="basic">Basic</option><option value="plus">Plus</option><option value="premium">Premium</option></select><button className="rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory">Filter</button></form>
    <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-paper"><table className="min-w-[1150px] w-full text-left text-sm"><thead className="border-b border-line text-xs uppercase tracking-[.12em] text-ink/45"><tr><th className="px-5 py-4">Transaksi</th><th className="px-5 py-4">Kontak</th><th className="px-5 py-4">Paket</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Metode</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Hadiah</th><th className="px-5 py-4">Tinjauan</th></tr></thead><tbody>{result.orders.map((order) => <tr key={order.orderId} className="border-b border-line/70 last:border-0"><td className="px-5 py-4"><span className="block max-w-40 truncate font-mono text-xs">{order.orderId}</span><span className="mt-1 block text-xs text-ink/45">{new Date(order.createdAtMs).toLocaleString('id-ID')}</span></td><td className="px-5 py-4"><span className="block">{order.customerEmail ?? '—'}</span><span className="mt-1 block text-xs text-ink/50">{order.customerWhatsapp ?? '—'}</span></td><td className="px-5 py-4">{order.packageName}</td><td className="px-5 py-4 font-semibold">{formatRupiah(order.amountIdr, 'id')}<span className="mt-1 block text-xs font-normal text-ink/45">−{formatRupiah(order.discountIdr, 'id')}</span></td><td className="px-5 py-4">{order.paymentMethodId}</td><td className="px-5 py-4"><span className="rounded-full bg-ivory px-3 py-1 text-xs">{label(order.status)}</span></td><td className="px-5 py-4">{order.publicSlug ? <Link href={`/g/${order.publicSlug}`} className="text-moss underline">Publik</Link> : <span className="text-ink/45">Belum terbit</span>}</td><td className="px-5 py-4"><Link href={`/admin/orders/${encodeURIComponent(order.orderId)}`} className="rounded-full border border-line px-3 py-2 text-xs font-semibold hover:bg-ivory">Detail</Link></td></tr>)}</tbody></table>{result.orders.length === 0 && <p className="p-8 text-center text-sm text-ink/55">Belum ada transaksi yang cocok.</p>}</div>
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
