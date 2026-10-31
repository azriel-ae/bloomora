import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Heart, LockKeyhole } from 'lucide-react';
import { PublicGiftActions } from '@/components/public-gift-actions';
import { GiftView } from '@/components/gift/gift-view';
import { TemplateArt } from '@/components/template-art';
import { getActiveTemplate, getTemplateForRender, listCatalog } from '@/lib/engine/registry';
import { getLocale, getMessages } from '@/lib/i18n';
import { getServerEnv } from '@/lib/server/runtime';
import { getPublicGift, recordPublicGiftView } from '@/lib/server/services';

async function readPublicGift(giftSlug: string) {
  const env = getServerEnv();
  if (!env) return null;
  const result = await getPublicGift(env, giftSlug);
  return result.ok ? result : null;
}

export async function generateMetadata({ params }: { params: Promise<{ giftSlug: string }> }): Promise<Metadata> {
  const { giftSlug } = await params;
  if (giftSlug === 'demo') return { title: 'Bloomora gift demo', robots: { index: false, follow: false } };
  const result = await readPublicGift(giftSlug);
  const published = result?.publicGift;
  const template = published ? getTemplateForRender(published.templateId, published.templateVersion) : null;
  return {
    title: template ? `${template.name.en} · Bloomora` : 'Bloomora gift',
    description: 'A digital gift made with care.',
    robots: published ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function StatusCard({ title, body, explore }: { title: string; body: string; explore: string }) {
  return <div className="min-h-[70vh] bg-[#eee9df] px-5 py-14 lg:py-24"><div className="mx-auto max-w-2xl rounded-[2rem] border border-line bg-paper p-8 text-center shadow-soft sm:p-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Bloomora gift</p><h1 className="mt-4 font-display text-4xl">{title}</h1><p className="mt-4 text-sm leading-6 text-ink/60">{body}</p><Link href="/templates" className="mt-7 inline-flex items-center rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{explore}<ArrowUpRight className="ml-2" size={16} /></Link></div></div>;
}

export default async function GiftPage({ params }: { params: Promise<{ giftSlug: string }> }) {
  const { giftSlug } = await params;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const recipient = messages.recipient;
  if (giftSlug === 'demo') {
    const demoTemplate = getActiveTemplate('pressed-garden') ?? listCatalog()[0] ?? null;
    return <div className="min-h-[70vh] bg-[#eee9df] px-5 py-14 lg:py-24"><div className="mx-auto max-w-2xl">{demoTemplate && <div className="rounded-[2.5rem] border border-line bg-paper p-4 shadow-paper"><TemplateArt template={demoTemplate} locale={locale} /></div>}<div className="mt-8 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{recipient.demoEyebrow}</p><h1 className="mt-4 font-display text-5xl">{recipient.demoTitle}</h1><p className="mx-auto mt-4 max-w-lg text-base leading-7 text-ink/60">{recipient.demoIntro}</p><div className="mt-7 flex justify-center gap-3"><span className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs text-ink/55"><LockKeyhole size={14} /> {recipient.private}</span><span className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs text-ink/55"><Heart size={14} /> {recipient.care}</span></div></div></div></div>;
  }

  const result = await readPublicGift(giftSlug);
  if (!result?.publicGift) {
    const status = result && 'status' in result ? result.status : 'missing';
    const copy = status === 'archived' ? { title: recipient.archived, body: recipient.archivedBody } : status === 'removed' ? { title: recipient.removed, body: recipient.removedBody } : { title: recipient.unavailable, body: recipient.unavailableBody };
    return <StatusCard title={copy.title} body={copy.body} explore={recipient.explore} />;
  }

  const gift = result.publicGift;
  const template = getTemplateForRender(gift.templateId, gift.templateVersion);
  if (!template) return <StatusCard title={recipient.unavailable} body={recipient.unavailableBody} explore={recipient.explore} />;
  const env = getServerEnv();
  if (env) await recordPublicGiftView(env, giftSlug);
  return <GiftView templateId={gift.templateId} templateVersion={gift.templateVersion} content={gift.content} locale={locale} mode="public" navActions={<PublicGiftActions labels={{ copy: recipient.copy, share: recipient.share, qr: recipient.qr, copied: recipient.copied, close: messages.common.close }} />} />;
}
