import type { Metadata } from 'next';
import { GuestCheckout } from '@/components/guest-checkout';
import { getLocale, getMessages } from '@/lib/i18n';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { getServerEnv } from '@/lib/server/runtime';
import { listActivePackages } from '@/lib/server/services';

export const metadata: Metadata = { title: 'Pembayaran', description: 'Selesaikan pesanan hadiah Bloomora tanpa membuat akun.', robots: { index: false, follow: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ giftId?: string }> }) {
  const [{ giftId }, locale] = await Promise.all([searchParams, getLocale()]);
  const messages = getMessages(locale);
  const env = getServerEnv();
  const result = env ? await listActivePackages(env) : null;
  const packages = env ? (result?.ok ? result.packages : []) : DEFAULT_PACKAGES;
  return <GuestCheckout giftId={typeof giftId === 'string' ? giftId : ''} locale={locale} copy={messages.checkout} packages={packages} />;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
