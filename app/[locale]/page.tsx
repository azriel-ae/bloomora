import type { Metadata } from 'next';
import { HomePage } from '@/components/home-page';
import { resolveLocale } from '@/lib/i18n-core';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const locale = resolveLocale((await params).locale); return { title: locale === 'id' ? 'Bloomora — Hadiah digital penuh rasa' : 'Bloomora — Digital gifts with a little more feeling', description: locale === 'id' ? 'Buat dunia kecil yang indah untuk seseorang yang kamu cintai — tanpa coding.' : 'Create a small, beautiful world for someone you love — no code required.', alternates: { languages: { id: '/id', en: '/en' } } }; }
export default function Page() { return <HomePage />; }
