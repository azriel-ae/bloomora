import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Hubungi Bloomora', description: 'Informasi kontak dan dukungan Bloomora.', alternates: { canonical: '/contact' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="contact" locale={resolveLocale((await params).locale)} />; }
