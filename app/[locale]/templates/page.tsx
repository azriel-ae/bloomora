import type { Metadata } from 'next';
import { TemplatesPageView } from '@/components/templates-page';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { getServerEnv } from '@/lib/server/runtime';
import { listActivePackages } from '@/lib/server/services';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Template hadiah', description: 'Mulai hadiah Bloomora dari template orisinal yang sesuai dengan cerita yang ingin kamu bagikan.', alternates: { canonical: '/templates' } };
}

export default async function TemplatesPage() {
  const env = getServerEnv();
  const result = env ? await listActivePackages(env) : null;
  const packages = env ? (result?.ok ? result.packages : []) : DEFAULT_PACKAGES;
  return <TemplatesPageView packages={packages} />;
}
