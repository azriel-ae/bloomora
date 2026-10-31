import { redirect, notFound } from 'next/navigation';
import { getActiveTemplate } from '@/lib/engine/registry';

/** Compatibility route: old single-segment paths represented template slugs, never persisted gift IDs. */
export default async function LegacyEditorRoute({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  if (giftId === 'demo') redirect('/demo/chapter-of-us');
  const template = getActiveTemplate(giftId);
  if (!template) notFound();
  redirect(`/editor/new?template=${encodeURIComponent(template.id)}`);
}
