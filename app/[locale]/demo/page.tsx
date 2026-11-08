import { redirect } from 'next/navigation';
import { getFeaturedDemoId } from '@/lib/server/featured-demo';
import { getServerEnv } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export default async function FeaturedDemoRedirect() {
  const env = getServerEnv();
  const templateId = env ? await getFeaturedDemoId(env) : 'chapter-of-us';
  redirect(`/demo/${encodeURIComponent(templateId)}`);
}
