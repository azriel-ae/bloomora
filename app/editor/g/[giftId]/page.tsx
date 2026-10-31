import type { Metadata } from 'next';
import { AuthCallout } from '@/components/auth-callout';
import { GiftEditor } from '@/components/gift-editor';
import { getCurrentUser } from '@/lib/session';
import { isEditorDevMode } from '@/lib/server/dev-editor-env';
import { getLocale, getMessages } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Edit gift draft', description: 'Edit a private Bloomora gift draft.' };

export default async function SavedGiftEditorPage({ params }: { params: Promise<{ giftId: string }> }) {
  const [{ giftId }, locale] = await Promise.all([params, getLocale()]);
  const devMode = isEditorDevMode();
  const user = devMode ? null : await getCurrentUser();
  const returnTo = `/editor/g/${encodeURIComponent(giftId)}`;
  if (!user && !devMode) {
    const messages = getMessages(locale);
    return <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24"><AuthCallout title={messages.authPage.editorTitle} eyebrow={messages.authPage.eyebrow} body={messages.authPage.editorIntro} returnTo={returnTo} /></div>;
  }
  return <GiftEditor giftId={giftId} devMode={devMode} />;
}
