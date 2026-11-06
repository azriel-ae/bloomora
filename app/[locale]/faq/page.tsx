import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
import { resolveLocale } from '@/lib/i18n-core';
export const metadata: Metadata = { title: 'Tanya jawab', description: 'Jawaban atas pertanyaan umum tentang Bloomora.', alternates: { canonical: '/faq' } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { return <LocalizedInfoPage page="faq" locale={resolveLocale((await params).locale)} />; }
