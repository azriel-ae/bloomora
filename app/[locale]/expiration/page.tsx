import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Masa berlaku hadiah', description: 'Informasi mengenai masa berlaku hadiah Bloomora.', alternates: { canonical: '/expiration' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="expiration" locale={resolveLocale((await params).locale)} />; }
