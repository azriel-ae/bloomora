'use client';

import Link from 'next/link';
import { useLocale } from './locale-provider';
import { PlateArt } from './gift/parts';
import { CATEGORIES } from '@/lib/engine/categories';
import { getFeaturedDemo } from '@/lib/engine/registry';
import { themeVars } from '@/lib/engine/theme-vars';
import { DEFAULT_PACKAGES } from '@/lib/packages';
import { formatRupiah } from '@/lib/i18n-core';

/** The single Featured Demo on the catalog: a real, explorable template, not a screenshot. */
export function FeaturedDemoBand() {
  const { locale, t } = useLocale();
  const tpl = getFeaturedDemo();
  if (!tpl) return null;
  const category = CATEGORIES.find((c) => c.id === tpl.category)?.label[locale];
  // Entry price = cheapest active package that may use this template's tier (seed values until packages come from the database).
  const prices = DEFAULT_PACKAGES.filter((p) => p.active && p.limits.allowedTemplateTiers.includes(tpl.tier)).map((p) => p.priceIdr);
  const from = prices.length ? Math.min(...prices) : null;
  return (
    <section aria-labelledby="featured-demo-title" className="mt-12 grid overflow-hidden rounded-[2.2rem] border border-line bg-paper shadow-soft lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-center p-8 sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('featuredDemo', 'eyebrow')}{category ? ` · ${category}` : ''}</p>
        <h2 id="featured-demo-title" className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{tpl.name[locale]}</h2>
        <p className="mt-2 text-lg italic text-ink/60">{tpl.tagline[locale]}</p>
        <p className="mt-5 max-w-lg leading-8 text-ink/60">{tpl.description[locale]}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={`/demo/${tpl.id}`} className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-ivory transition hover:bg-ink">{t('featuredDemo', 'viewDemo')}</Link>
          <Link href={`/create?template=${tpl.id}`} className="rounded-full border border-ink/25 px-6 py-3 text-sm font-semibold transition hover:border-ink">{t('featuredDemo', 'useTemplate')}</Link>
        </div>
        <p className="mt-4 text-sm text-ink/55">{t('featuredDemo', 'noSignup')}{from !== null ? ` ${t('featuredDemo', 'from')}: ${formatRupiah(from, locale)}.` : ''}</p>
      </div>
      <div aria-hidden="true" className="flex items-center justify-center gap-3 bg-ivory p-8 sm:p-12" style={themeVars(tpl.theme) as React.CSSProperties}>
        {[3, 0, 1].map((idx, i) => (
          <div key={idx} className={`w-1/3 max-w-[9.5rem] border p-1.5 ${i === 1 ? '-translate-y-5' : ''}`} style={{ background: 'var(--bl-surface)', borderColor: 'var(--bl-line)' }}>
            <PlateArt index={idx} className="block h-auto w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
