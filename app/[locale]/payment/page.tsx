import type { Metadata } from 'next';
import { InfoPage } from '@/components/info-page';
import { getMessages, resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Panduan pembayaran', description: 'Cara pembayaran QRIS manual dan verifikasi pesanan Bloomora.', alternates: { canonical: '/payment' } };
export default async function PaymentPage({ params }: { params: Promise<{ locale: string }> }) { const locale = resolveLocale((await params).locale); const m = getMessages(locale); return <InfoPage eyebrow={m.info.paymentEyebrow} title={m.info.paymentTitle} intro={m.info.paymentIntro} sections={[{ heading: m.info.step1, body: m.info.step1Body }, { heading: m.info.step2, body: m.info.step2Body }, { heading: m.info.step3, body: m.info.step3Body }, { heading: m.info.step4, body: m.info.step4Body }]} />; }
