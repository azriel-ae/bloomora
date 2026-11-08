import { redirect, notFound } from 'next/navigation';
import { getActiveTemplate } from '@/lib/engine/registry';

/** Compatibility route: old single-segment paths represented template slugs, never persisted gift IDs. */
export default async function LegacyEditorRoute({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  if (giftId === 'demo') redirect('/demo');
  const template = getActiveTemplate(giftId);
  if (!template) notFound();
  redirect(`/editor/new?template=${encodeURIComponent(template.id)}`);
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
