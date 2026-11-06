import type { Metadata } from 'next';
import { GiftEditor } from '@/components/gift-editor';
import { getActiveTemplate } from '@/lib/engine/registry';
import { isEditorDevMode } from '@/lib/server/dev-editor-env';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Draf hadiah baru', description: 'Mulai draf hadiah privat dari template Bloomora.', robots: { index: false, follow: false } };

export default async function NewGiftEditorPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: templateId } = await searchParams;
  const template = templateId ? getActiveTemplate(templateId) : null;
  if (!template) notFound();
  return <GiftEditor initialTemplateId={template.id} devMode={isEditorDevMode()} />;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
