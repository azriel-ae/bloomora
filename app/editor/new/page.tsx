import type { Metadata } from 'next';
import { AuthCallout } from '@/components/auth-callout';
import { GiftEditor } from '@/components/gift-editor';
import { getCurrentUser } from '@/lib/session';
import { isEditorDevMode } from '@/lib/server/dev-editor-env';
import { getActiveTemplate } from '@/lib/engine/registry';
import { getLocale, getMessages } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'New gift draft', description: 'Start a private gift draft from a Bloomora template.' };

export default async function NewGiftEditorPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const [{ template: templateId }, locale] = await Promise.all([searchParams, getLocale()]);
  const template = templateId ? getActiveTemplate(templateId) : null;
  if (!template) notFound();
  const devMode = isEditorDevMode();
  const user = devMode ? null : await getCurrentUser();
  const returnTo = `/editor/new?template=${encodeURIComponent(template.id)}`;
  if (!user && !devMode) {
    const messages = getMessages(locale);
    return <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24"><AuthCallout title={messages.createPage.authTitle} eyebrow={messages.createPage.authEyebrow} body={messages.createPage.authBody} registerLabel={messages.createPage.register} loginLabel={messages.createPage.login} returnTo={returnTo} /></div>;
  }
  return <GiftEditor initialTemplateId={template.id} devMode={devMode} />;
}
