import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Kebijakan media', description: 'Ketentuan media untuk hadiah digital Bloomora.', alternates: { canonical: '/media-policy' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="media" locale={resolveLocale((await params).locale)} />; }
