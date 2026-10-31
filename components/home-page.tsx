'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, Heart, Leaf, LockKeyhole, Sparkles } from 'lucide-react';
import { useLocale } from './locale-provider';
import { TemplateArt } from './template-art';
import { CATEGORIES } from '@/lib/engine/categories';
import { getFeaturedDemo, listCatalog } from '@/lib/engine/registry';
import { formatRupiah } from '@/lib/i18n-core';

export function HomePage() {
  const { t, locale } = useLocale();
  const templates = listCatalog();
  const heroTemplate = getFeaturedDemo() ?? templates[0] ?? null;
  const homeTemplates = templates.slice(0, 3);
  const steps = [
    ['01', t('home', 'step1'), t('home', 'step1Body')],
    ['02', t('home', 'step2'), t('home', 'step2Body')],
    ['03', t('home', 'step3'), t('home', 'step3Body')],
  ] as const;
  const features = [
    [t('home', 'feature1'), t('home', 'feature1Body'), LockKeyhole],
    [t('home', 'feature2'), t('home', 'feature2Body'), Sparkles],
    [t('home', 'feature3'), t('home', 'feature3Body'), Leaf],
    [t('home', 'feature4'), t('home', 'feature4Body'), Heart],
  ] as const;
  const faqs = [
    [t('home', 'faq1'), t('home', 'faq1Body')],
    [t('home', 'faq2'), t('home', 'faq2Body')],
    [t('home', 'faq3'), t('home', 'faq3Body')],
  ] as const;

  return (
    <>
      <section className="paper-grid overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <div className="stem-divider mb-7 max-w-xs"><span>{t('home', 'eyebrow')}</span></div>
            <h1 className="max-w-2xl font-display text-5xl leading-[.98] tracking-[-.045em] sm:text-7xl">{t('home', 'headline')}</h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-ink/65 sm:text-lg">{t('home', 'description')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-full bg-moss px-6 py-3.5 text-sm font-semibold text-ivory shadow-soft transition hover:-translate-y-0.5 hover:bg-ink">{t('home', 'start')} <ArrowUpRight className="ml-2 inline" size={16} /></Link>
              <Link href="/templates" className="rounded-full border border-line bg-paper/60 px-6 py-3.5 text-sm font-semibold transition hover:border-moss">{t('home', 'explore')}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-ink/55">
              <span className="flex items-center gap-2"><LockKeyhole size={14} className="text-moss" /> {t('home', 'privacy')}</span>
              <span className="flex items-center gap-2"><Leaf size={14} className="text-moss" /> {t('home', 'noCode')}</span>
            </div>
          </div>
          {heroTemplate && (
            <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
              <div className="absolute -right-8 -top-8 hidden h-28 w-28 rounded-full border border-moss/20 lg:block" />
              <div className="rotate-[-3deg] rounded-[2.4rem] border border-line bg-paper p-3 shadow-paper transition duration-500 hover:rotate-0"><TemplateArt template={heroTemplate} locale={locale} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('home', 'collection')}</p><h2 className="mt-3 font-display text-4xl tracking-[-.03em] sm:text-5xl">{t('home', 'templateHeading')}</h2></div>
          <Link href="/templates" className="flex items-center gap-2 text-sm font-semibold text-moss">{t('home', 'seeAll')} <ArrowUpRight size={16} /></Link>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {homeTemplates.map((template) => {
            const category = CATEGORIES.find((item) => item.id === template.category)?.label[locale] ?? template.category;
            return (
              <Link key={template.id} href={`/templates/${template.id}`} className="group">
                <div className="relative"><TemplateArt template={template} locale={locale} /><span className="absolute left-4 top-4 rounded-full bg-paper/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-moss">{category}</span></div>
                <h3 className="mt-4 font-display text-2xl group-hover:underline group-hover:decoration-moss">{template.name[locale]}</h3>
                <p className="mt-1 text-sm leading-6 text-ink/60">{template.description[locale]}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-[#eee9df]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-24">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('home', 'stepsHeading')}</p><h2 className="mt-3 max-w-md font-display text-4xl leading-tight sm:text-5xl">{t('home', 'stepsIntro')}</h2></div>
          <div className="grid gap-8 sm:grid-cols-3">{steps.map(([num, title, body]) => <div key={num} className="border-t border-ink/15 pt-4"><span className="font-display text-3xl italic text-rose">{num}</span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{body}</p></div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_.92fr] lg:items-start">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('home', 'collection')}</p><h2 className="mt-3 max-w-lg font-display text-4xl leading-tight sm:text-5xl">{t('home', 'featuresHeading')}</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">{features.map(([title, body, Icon]) => <div key={title} className="rounded-3xl border border-line bg-paper p-6"><Icon size={20} className="text-moss" /><h3 className="mt-5 font-display text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{body}</p></div>)}</div>
        </div>
      </section>

      <section className="bg-moss text-ivory">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:px-8 lg:py-24">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-sage">{t('home', 'pricingHeading')}</p><h2 className="mt-3 max-w-lg font-display text-4xl leading-tight sm:text-5xl">{t('home', 'pricingHeading')}</h2><Link href="/pricing" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-3 text-sm font-semibold text-moss">{t('home', 'pricingCta')} <ArrowUpRight size={16} /></Link></div>
          <div className="grid gap-3 sm:grid-cols-3">{[['Basic', 19000, 3], ['Plus', 39000, 14], ['Premium', 69000, 30]].map(([name, price, days], index) => <div key={String(name)} className={`rounded-3xl p-5 ${index === 1 ? 'bg-ivory text-ink' : 'border border-ivory/20 bg-ivory/10'}`}><p className="text-xs font-bold uppercase tracking-[.16em] opacity-65">{String(name)}</p><p className="mt-8 font-display text-3xl">{formatRupiah(Number(price), locale)}</p><p className="mt-1 text-sm opacity-65">{locale === 'id' ? `aktif ${days} hari` : `active for ${days} days`}</p><div className="mt-6 space-y-2 text-xs opacity-75"><p><Check className="mr-1 inline" size={13} /> {t('common', 'preview')}</p><p><Check className="mr-1 inline" size={13} /> {locale === 'id' ? 'Tautan privat' : 'Private share link'}</p></div></div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 lg:py-28">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('home', 'faqHeading')}</p><h2 className="mt-3 font-display text-4xl sm:text-5xl">{t('home', 'faqHeading')}</h2></div>
        <div className="mt-10 divide-y divide-line border-y border-line">{faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl [&::-webkit-details-marker]:hidden"><span>{question}</span><ArrowDown size={18} className="shrink-0 text-moss transition group-open:rotate-180" /></summary><p className="max-w-2xl pt-3 text-sm leading-6 text-ink/60">{answer}</p></details>)}</div>
      </section>

      <section className="px-5 pb-20 lg:pb-28">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#ead8d0] px-6 py-14 text-center sm:px-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8f5c55]">{t('home', 'ctaEyebrow')}</p><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">{t('home', 'ctaHeading')}</h2><Link href="/create" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-ivory transition hover:bg-moss">{t('home', 'start')} <ArrowUpRight className="ml-2" size={16} /></Link></div>
      </section>
    </>
  );
}
