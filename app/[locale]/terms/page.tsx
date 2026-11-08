import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Ketentuan layanan', description: 'Ketentuan penggunaan layanan Bloomora.', alternates: { canonical: '/terms' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="terms" locale={resolveLocale((await params).locale)} />; }
