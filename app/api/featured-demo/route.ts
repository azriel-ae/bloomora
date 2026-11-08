import { NextResponse } from 'next/server';
import { getActiveTemplate, listCatalog } from '@/lib/engine/registry';
import { getFeaturedDemoId } from '@/lib/server/featured-demo';
import { getServerEnv } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getServerEnv();
  const templateId = env
    ? await getFeaturedDemoId(env)
    : getActiveTemplate('chapter-of-us')?.id ?? listCatalog()[0]?.id ?? 'chapter-of-us';
  return NextResponse.json(
    { templateId },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
