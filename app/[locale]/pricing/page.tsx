import type { Metadata } from 'next';
import { PricingPageView } from '@/components/pricing-page';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { getServerEnv } from '@/lib/server/runtime';
import { listActivePackages } from '@/lib/server/services';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Harga', description: 'Harga yang jelas dan transparan untuk hadiah yang tetap terbuka selama dibutuhkan.', alternates: { canonical: '/pricing' } };
}

export default async function PricingPage() {
  const env = getServerEnv();
  const result = env ? await listActivePackages(env) : null;
  const packages = env ? (result?.ok ? result.packages : []) : DEFAULT_PACKAGES;
  return <PricingPageView packages={packages} />;
}
