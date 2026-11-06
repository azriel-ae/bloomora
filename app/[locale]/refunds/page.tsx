import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Pengembalian dana dan pembatalan', description: 'Ketentuan pengembalian dana dan pembatalan pesanan Bloomora.', alternates: { canonical: '/refunds' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="refunds" locale={resolveLocale((await params).locale)} />; }
