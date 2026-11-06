import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, Gift, ReceiptText, WalletCards } from 'lucide-react';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { getAdminOverview } from '@/lib/server/services';
import { formatRupiah } from '@/lib/i18n-core';
import { AuthCallout } from '@/components/auth-callout';

export const metadata: Metadata = { title: 'Admin dashboard', description: 'Bloomora administration overview.', robots: { index: false, follow: false } };
const statusLabel: Record<string, string> = { awaiting_payment: 'Awaiting payment', proof_submitted: 'Needs review', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const statusClass: Record<string, string> = { awaiting_payment: 'bg-[#f7ead1] text-[#8b6a2b]', proof_submitted: 'bg-sage/30 text-moss', approved: 'bg-[#dfe9dc] text-moss', rejected: 'bg-[#f2dfd8] text-[#9d5d54]', cancelled: 'bg-ivory text-ink/50' };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.admin) return <div className="mx-auto max-w-3xl py-16"><AuthCallout title="Admin access required" /></div>;
  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-3xl py-16"><div className="rounded-3xl border border-line bg-paper p-8"><h1 className="font-display text-3xl">Dashboard unavailable</h1><p className="mt-3 text-sm leading-6 text-ink/60">Supabase server configuration is required before admin data can be loaded.</p></div></div>;
  const result = await getAdminOverview(env, { uid: user.uid, admin: true });
  if (!result.ok) return <div className="mx-auto max-w-3xl py-16"><p role="alert">Unable to load dashboard: {result.code}</p></div>;
  const stats = [
    { label: 'Total transactions', value: result.summary.transactions, icon: ReceiptText },
    { label: 'Approved revenue', value: formatRupiah(result.summary.revenueIdr, 'id'), icon: WalletCards },
    { label: 'Pending attention', value: result.summary.pending, icon: Clock3 },
    { label: 'Published gifts', value: result.summary.publishedGifts, icon: Gift },
  ];
  return <div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Overview</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Good morning, Bloomora.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">A clear view of what needs your attention today. Revenue reflects approved payments only.</p></div><Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-semibold text-ivory hover:shadow-soft">Review orders <ArrowUpRight size={16} /></Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-3xl border border-line bg-paper p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">{label}</p><span className="grid size-9 place-items-center rounded-xl bg-sage/20 text-moss"><Icon size={18} /></span></div><p className="mt-6 font-display text-3xl">{value}</p></div>)}</div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_.55fr]"><section className="rounded-3xl border border-line bg-paper"><div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6"><div><h2 className="font-display text-2xl">Recent transactions</h2><p className="mt-1 text-sm text-ink/50">Latest activity from your sales flow.</p></div><Link href="/admin/orders" className="text-sm font-semibold text-moss">View all</Link></div>{result.recentOrders.length === 0 ? <div className="px-6 py-14 text-center"><CreditCard className="mx-auto text-moss/50" /><p className="mt-3 text-sm text-ink/55">No transactions yet.</p></div> : <div className="divide-y divide-line">{result.recentOrders.map((order) => <Link href={`/admin/orders/${encodeURIComponent(order.orderId)}`} key={order.orderId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-ivory sm:px-6"><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold">{order.orderId}</p><p className="mt-1 text-sm text-ink/55">{order.packageName} · {new Date(order.createdAtMs).toLocaleDateString('id-ID')}</p></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass[order.status] ?? 'bg-ivory text-ink/55'}`}>{statusLabel[order.status] ?? order.status}</span><span className="text-sm font-semibold">{formatRupiah(order.amountIdr, 'id')}</span></div></Link>)}</div>}</section>
      <section className="rounded-3xl border border-line bg-paper p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">Quick links</p><h2 className="mt-3 font-display text-2xl">Keep things moving.</h2><div className="mt-6 space-y-3"><Link href="/admin/payment-methods" className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-4 text-sm font-semibold hover:bg-sage/20"><span className="flex items-center gap-3"><CreditCard size={18} className="text-moss" /> Payment methods</span><ArrowUpRight size={16} /></Link><Link href="/admin/packages" className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-4 text-sm font-semibold hover:bg-sage/20"><span className="flex items-center gap-3"><CheckCircle2 size={18} className="text-moss" /> Package settings</span><ArrowUpRight size={16} /></Link></div></section>
    </div>
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
