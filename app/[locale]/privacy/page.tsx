import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Privasi', description: 'Informasi privasi dan pengelolaan data Bloomora.', alternates: { canonical: '/privacy' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="privacy" locale={resolveLocale((await params).locale)} />; }
