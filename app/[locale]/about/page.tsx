import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Tentang Bloomora', description: 'Cerita dan informasi tentang Bloomora.', alternates: { canonical: '/about' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="about" locale={resolveLocale((await params).locale)} />; }
