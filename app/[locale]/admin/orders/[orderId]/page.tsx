import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminOrderReview } from '@/components/admin/order-review';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { getAdminOrderDetail } from '@/lib/server/services';

export const metadata: Metadata = { title: 'Order review | Bloomora admin', robots: { index: false, follow: false } };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, user] = await Promise.all([params, getCurrentUser()]);
  const isAdmin = Boolean(user && (user as { admin?: boolean }).admin === true);
  if (!isAdmin) return <main className="mx-auto max-w-3xl px-5 py-20"><div className="rounded-3xl border border-line bg-paper p-8"><h1 className="font-display text-3xl">Admin access required</h1><p className="mt-3 text-sm text-ink/60">Sign in through the restricted admin login to view transaction details.</p><Link href="/admin/login" className="mt-6 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">Admin login</Link></div></main>;
  const env = getServerEnv();
  if (!env) return <main className="mx-auto max-w-3xl px-5 py-20"><h1 className="font-display text-3xl">Order review unavailable</h1><p className="mt-3 text-sm text-ink/60">Supabase server configuration is required before order details can be loaded.</p></main>;
  const result = await getAdminOrderDetail(env, { uid: user!.uid, admin: true }, orderId);
  if (!result.ok) return <main className="mx-auto max-w-3xl px-5 py-20"><Link href="/admin/orders" className="text-sm text-ink/55">← Kembali ke transaksi</Link><p role="alert" className="mt-8 text-sm">Order tidak ditemukan: {result.code}</p></main>;
  return <main className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20"><Link href="/admin/orders" className="text-sm text-ink/55">← Kembali ke transaksi</Link><AdminOrderReview order={result.order} audit={result.audit} /></main>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
