import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getActiveTemplate, listCatalog } from '@/lib/engine/registry';
import { CATEGORIES } from '@/lib/engine/categories';
import type { SectionType } from '@/lib/engine/types';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { formatRupiah } from '@/lib/i18n-core';
import { getLocale, getMessages } from '@/lib/i18n';
import { TemplateArt } from '@/components/template-art';
import { AuthCallout } from '@/components/auth-callout';

export function generateStaticParams() {
  return listCatalog().map((template) => ({ slug: template.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const locale = await getLocale();
  const template = getActiveTemplate((await params).slug);
  if (!template) return { title: getMessages(locale).templateDetail.notFound };
  return { title: template.name[locale], description: template.description[locale] };
}

const sectionMessageKey: Record<SectionType, keyof typeof import('@/messages/en.json').gift> = {
  opening: 'sectionOpening', hero: 'sectionHero', letter: 'sectionLetter', gallery: 'sectionGallery',
  timeline: 'sectionTimeline', message: 'sectionMessage', appreciation: 'sectionAppreciation',
  music: 'sectionMusic', closing: 'sectionClosing',
};

export default async function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = getActiveTemplate(slug);
  if (!template) notFound();

  const locale = await getLocale();
  const messages = getMessages(locale);
  const category = CATEGORIES.find((item) => item.id === template.category)?.label[locale] ?? template.category;
  const eligiblePackages = DEFAULT_PACKAGES
    .filter((item) => item.active && item.limits.allowedTemplateTiers.includes(template.tier))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const sectionLabels = messages.gift as Record<string, string>;
  const templateBadges = [
    template.featured && messages.templatesPage.featured,
    template.popular && messages.templatesPage.popular,
    template.isNew && messages.templatesPage.new,
  ].filter((label): label is string => Boolean(label));

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20">
      <Link href="/templates" className="inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> {messages.templateDetail.back}
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-moss">
            <span>{category}</span>
            {templateBadges.map((badge) => <span key={badge} className="rounded-full border border-line px-3 py-1 text-[10px]">{badge}</span>)}
          </div>
          <h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">{template.name[locale]}</h1>
          <p className="mt-3 text-lg italic text-ink/60">{template.tagline[locale]}</p>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink/65">{template.description[locale]}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/create?template=${template.id}`} className="rounded-full bg-moss px-6 py-3.5 text-sm font-semibold text-ivory transition hover:bg-ink">
              {messages.templateDetail.use} <ArrowUpRight className="ml-2 inline" size={16} aria-hidden="true" />
            </Link>
            {template.hasDemo && <Link href={`/demo/${template.id}`} className="rounded-full border border-line px-6 py-3.5 text-sm font-semibold transition hover:border-moss">{messages.templateDetail.viewDemo}</Link>}
          </div>
        </div>
        <div className="rounded-[2.5rem] border border-line bg-paper p-3 shadow-paper sm:p-4">
          <TemplateArt template={template} locale={locale} />
          <p className="px-4 pb-2 pt-4 text-xs text-ink/50">{messages.templateDetail.previewNote}</p>
        </div>
      </div>

      <div className="mt-16 grid gap-10 border-t border-line pt-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <section aria-labelledby="template-sections-title">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.templateDetail.detailsEyebrow}</p>
          <h2 id="template-sections-title" className="mt-3 font-display text-3xl sm:text-4xl">{messages.templateDetail.sectionsHeading}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {template.sections.map((section) => (
              <li key={section.id} className="flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-4 text-sm leading-6">
                <Check size={16} className="mt-1 shrink-0 text-moss" aria-hidden="true" />
                <span>{sectionLabels[sectionMessageKey[section.type]]}{section.optional ? ` · ${messages.templateDetail.optional}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="template-packages-title" className="rounded-[2rem] border border-line bg-paper p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.templateDetail.tierLabel}: {template.tier === 'core' ? messages.templateDetail.tierCore : messages.templateDetail.tierExtended}</p>
          <h2 id="template-packages-title" className="mt-3 font-display text-3xl">{messages.templateDetail.eligiblePackages}</h2>
          {eligiblePackages.length > 0 ? (
            <ul className="mt-5 divide-y divide-line">
              {eligiblePackages.map((item) => (
                <li key={item.id} data-eligible-package={item.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-ink/55">{messages.pricingPage.active} {item.durationDays} {locale === 'id' ? 'hari' : 'days'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatRupiah(item.priceIdr, locale)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-5 text-sm text-ink/60">{messages.templateDetail.noEligiblePackages}</p>}
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink/55">{messages.templateDetail.eligibilityNote}</p>
        </section>
      </div>

      <div className="mt-16">
        <AuthCallout
          title={messages.templateDetail.make}
          eyebrow={messages.templateDetail.authEyebrow}
          body={messages.templateDetail.authBody}
          registerLabel={messages.templateDetail.register}
          loginLabel={messages.templateDetail.login}
        />
      </div>
    </div>
  );
}
