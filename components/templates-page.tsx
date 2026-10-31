'use client';

import { useMemo, useState } from 'react';
import type { CategoryId } from '@/lib/engine/types';
import { CATEGORIES } from '@/lib/engine/categories';
import { searchCatalog } from '@/lib/engine/registry';
import { TemplateCard } from './template-card';
import { useLocale } from './locale-provider';
import { FeaturedDemoBand } from './featured-demo-band';

export function TemplatesPageView() {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const result = useMemo(() => {
    try {
      return { templates: searchCatalog(query, locale, selectedCategory), error: false };
    } catch {
      return { templates: [], error: true };
    }
  }, [locale, query, selectedCategory]);

  const clearFilters = () => { setQuery(''); setSelectedCategory(null); };

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('templatesPage', 'eyebrow')}</p>
        <h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">{t('templatesPage', 'title')}</h1>
        <p className="mt-5 text-lg leading-8 text-ink/60">{t('templatesPage', 'intro')}</p>
      </div>

      <FeaturedDemoBand />

      <section aria-label={t('templatesPage', 'catalog')} className="mt-12">
        <div className="max-w-xl">
          <label htmlFor="template-search" className="mb-2 block text-sm font-semibold">{t('templatesPage', 'searchLabel')}</label>
          <input
            id="template-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('templatesPage', 'searchPlaceholder')}
            className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
        </div>

        <fieldset className="mt-6 border-y border-line py-4">
          <legend className="sr-only">{t('templatesPage', 'filterLabel')}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('templatesPage', 'filterLabel')}>
            <button
              type="button"
              aria-pressed={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedCategory === null ? 'bg-moss text-ivory' : 'border border-line text-ink/60 hover:border-moss'}`}
            >{t('templatesPage', 'all')}</button>
            {CATEGORIES.map((category) => (
              <button
                type="button"
                key={category.id}
                data-category-filter={category.id}
                aria-pressed={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${selectedCategory === category.id ? 'bg-moss font-semibold text-ivory' : 'border border-line text-ink/60 hover:border-moss'}`}
              >{category.label[locale]}</button>
            ))}
          </div>
        </fieldset>

        <p aria-live="polite" className="mt-5 text-sm text-ink/55">
          {t('templatesPage', 'resultCount').replace('{count}', String(result.templates.length))}
        </p>

        {result.error ? (
          <div role="alert" className="mt-8 rounded-3xl border border-line bg-paper p-8 text-center">
            <h2 className="font-display text-2xl">{t('templatesPage', 'loadError')}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink/60">{t('templatesPage', 'loadErrorBody')}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{t('templatesPage', 'retry')}</button>
          </div>
        ) : result.templates.length > 0 ? (
          <div className="mt-8 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {result.templates.map((template) => <TemplateCard key={template.id} template={template} />)}
          </div>
        ) : (
          <div data-empty-catalog className="mt-8 rounded-3xl border border-line bg-paper px-6 py-12 text-center sm:px-10">
            <h2 className="font-display text-2xl">{t('templatesPage', 'emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink/60">{t('templatesPage', 'emptyBody')}</p>
            <button type="button" onClick={clearFilters} className="mt-5 rounded-full border border-line px-5 py-3 text-sm font-semibold transition hover:border-moss hover:text-moss">{t('templatesPage', 'clearFilters')}</button>
          </div>
        )}
      </section>
    </div>
  );
}
