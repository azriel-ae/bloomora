import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GiftEditor } from '@/components/gift-editor';
import { getServerEnv } from '@/lib/server/runtime';
import { resolveGuestEditToken } from '@/lib/server/guest-services';
import { getDevEditorEnv, isEditorDevMode } from '@/lib/server/dev-editor-env';

export const metadata: Metadata = {
  title: 'Secure gift editor | Bloomora',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function BearerGiftEditorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const devMode = isEditorDevMode();
  const env = devMode ? getDevEditorEnv() : getServerEnv();
  if (!env) notFound();
  const result = await resolveGuestEditToken(env, token);
  if (!result.ok) notFound();
  return <GiftEditor giftId={result.giftId} initialEditToken={token} devMode={devMode} />;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
