import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCallout } from '@/components/auth-callout';
import { VouchersManager } from '@/components/admin/vouchers-manager';
import { getLocale, getMessages } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { listAdminVouchers } from '@/lib/server/services';

export const metadata: Metadata = { title: 'Vouchers | Bloomora admin', robots: { index: false, follow: false } };

export default async function AdminVouchersPage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const messages = getMessages(locale);
  const copy = messages.voucherAdmin;
  if (!user || (user as { admin?: boolean }).admin !== true) return <div className="mx-auto max-w-3xl px-5 py-20"><AuthCallout title={messages.admin.gated} /></div>;
  const env = getServerEnv();
  if (!env) return <div className="mx-auto max-w-5xl px-5 py-14"><Link href="/admin" className="text-sm text-ink/55">{messages.adminSection.back}</Link><h1 className="mt-8 font-display text-4xl">{copy.title}</h1><p className="mt-4 rounded-2xl border border-line bg-paper p-5 text-sm">Supabase server configuration is required to load or save vouchers.</p></div>;
  const result = await listAdminVouchers(env, { uid: user.uid, admin: true });
  if (!result.ok) return <div className="mx-auto max-w-5xl px-5 py-14"><p role="alert">Unable to load vouchers: {result.code}</p></div>;
  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
    <Link href="/admin" className="text-sm text-ink/55">{messages.adminSection.back}</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.admin.eyebrow}</p>
    <h1 className="mt-3 font-display text-5xl">{copy.title}</h1>
    <VouchersManager initialVouchers={result.vouchers} copy={copy} />
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
