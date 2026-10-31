'use client';

import { TemplateCard } from './template-card';
import { categories } from '@/lib/brand';
import { templates } from '@/lib/templates';
import { useLocale } from './locale-provider';
import { FeaturedDemoBand } from './featured-demo-band';

export function TemplatesPageView() { const { t } = useLocale(); return <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('templatesPage', 'eyebrow')}</p><h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">{t('templatesPage', 'title')}</h1><p className="mt-5 text-lg leading-8 text-ink/60">{t('templatesPage', 'intro')}</p></div><FeaturedDemoBand /><div className="mt-12 flex flex-wrap gap-2 border-y border-line py-4"><span className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-ivory">{t('templatesPage', 'all')}</span>{categories.map((category) => <span key={category} className="rounded-full border border-line px-4 py-2 text-sm text-ink/60">{category}</span>)}</div><div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">{templates.map((template) => <TemplateCard key={template.slug} template={template} />)}</div></div>; }
