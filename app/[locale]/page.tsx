import type { Metadata } from 'next';
import { HomePage } from '@/components/home-page';
import { getServerEnv } from '@/lib/server/runtime';
import { getFeaturedDemoId } from '@/lib/server/featured-demo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Bloomora — Hadiah digital penuh cerita',
    description: 'Buat hadiah digital yang personal dan indah untuk orang tersayang, tanpa perlu menulis kode.',
    alternates: { canonical: '/' },
  };
}

export default async function Page() {
  const env = getServerEnv();
  const featuredTemplateId = env ? await getFeaturedDemoId(env) : 'chapter-of-us';
  return <HomePage featuredTemplateId={featuredTemplateId} />;
}
