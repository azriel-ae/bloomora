import type { Metadata } from 'next';
import { GiftEditor } from '@/components/gift-editor';
import { isEditorDevMode } from '@/lib/server/dev-editor-env';

export const metadata: Metadata = { title: 'Edit draf hadiah', description: 'Edit draf hadiah Bloomora yang privat.', robots: { index: false, follow: false } };

export default async function SavedGiftEditorPage({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  return <GiftEditor giftId={giftId} devMode={isEditorDevMode()} />;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
