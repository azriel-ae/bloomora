import type { Metadata } from 'next';
import Link from 'next/link';
import { GuestOrderDetail } from '@/components/guest-order-detail';
import { getLocale, getMessages } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Detail pembayaran pesanan', robots: { index: false, follow: false } };

export default async function GuestOrderPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, locale] = await Promise.all([params, getLocale()]);
  const messages = getMessages(locale);
  const copy = { ...messages.paymentDetail, close: messages.common.close };
  return <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
    <Link href="/payment" className="text-sm text-ink/55">{messages.common.back}</Link>
    <div className="mt-8"><GuestOrderDetail orderId={orderId} locale={locale} copy={copy} /></div>
  </main>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
