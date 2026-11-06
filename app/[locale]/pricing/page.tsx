import type { Metadata } from 'next';
import { PricingPageView } from '@/components/pricing-page';
import { getLocale } from '@/lib/i18n';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { getServerEnv } from '@/lib/server/runtime';
import { listActivePackages } from '@/lib/server/services';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: locale === 'id' ? 'Harga' : 'Pricing', description: locale === 'id' ? 'Harga sederhana dan transparan untuk hadiah yang tetap terbuka selama dibutuhkan.' : 'Simple, transparent pricing for gifts that stay open as long as they need to.', alternates: { languages: { id: '/id/pricing', en: '/en/pricing' } } };
}

export default async function PricingPage() {
  const env = getServerEnv();
  const result = env ? await listActivePackages(env) : null;
  const packages = env ? (result?.ok ? result.packages : []) : DEFAULT_PACKAGES;
  return <PricingPageView packages={packages} />;
}
