import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Heart, LockKeyhole } from 'lucide-react';
import { TemplateArt } from '@/components/template-art';
import { getActiveTemplate, listCatalog } from '@/lib/engine/registry';
import { getLocale, getMessages } from '@/lib/i18n';

export const metadata: Metadata = { title: 'A Bloomora gift', description: 'A private digital gift made with care.' };

export default async function GiftPage({ params }: { params: Promise<{ giftSlug: string }> }) {
  const { giftSlug } = await params;
  const isDemo = giftSlug === 'demo';
  const locale = await getLocale();
  const messages = getMessages(locale);
  const demoTemplate = getActiveTemplate('pressed-garden') ?? listCatalog()[0] ?? null;

  return (
    <div className="min-h-[70vh] bg-[#eee9df] px-5 py-14 lg:py-24">
      <div className="mx-auto max-w-2xl">
        {isDemo ? (
          <>
            {demoTemplate && <div className="rounded-[2.5rem] border border-line bg-paper p-4 shadow-paper"><TemplateArt template={demoTemplate} locale={locale} /></div>}
            <div className="mt-8 text-center">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.recipient.demoEyebrow}</p>
              <h1 className="mt-4 font-display text-5xl">{messages.recipient.demoTitle}</h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-ink/60">{messages.recipient.demoIntro}</p>
              <div className="mt-7 flex justify-center gap-3">
                <span className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs text-ink/55"><LockKeyhole size={14} /> {messages.recipient.private}</span>
                <span className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs text-ink/55"><Heart size={14} /> {messages.recipient.care}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[2rem] border border-line bg-paper p-8 text-center shadow-soft sm:p-12">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.recipient.gift}</p>
            <h1 className="mt-4 font-display text-4xl">{messages.recipient.unavailable}</h1>
            <p className="mt-4 text-sm leading-6 text-ink/60">{messages.recipient.unavailableBody}</p>
            <Link href="/templates" className="mt-7 inline-flex items-center rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{messages.recipient.explore} <ArrowUpRight className="ml-2" size={16} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
