import type { Metadata } from 'next';
import { PricingPageView } from '@/components/pricing-page';
import { getLocale } from '@/lib/i18n';
export async function generateMetadata(): Promise<Metadata> { const locale = await getLocale(); return { title: locale === 'id' ? 'Harga' : 'Pricing', description: locale === 'id' ? 'Harga sederhana dan transparan untuk hadiah yang tetap terbuka selama dibutuhkan.' : 'Simple, transparent pricing for gifts that stay open as long as they need to.', alternates: { languages: { id: '/id/pricing', en: '/en/pricing' } } }; }
export default function PricingPage() { return <PricingPageView />; }
