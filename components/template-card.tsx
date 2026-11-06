'use client';

import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TemplateConfig } from '@/lib/engine/types';
import { CATEGORIES } from '@/lib/engine/categories';
import { TemplateArt } from './template-art';
import { useLocale } from './locale-provider';

export function TemplateCard({ template }: { template: TemplateConfig }) {
  const { locale, t } = useLocale();
  const category = CATEGORIES.find((item) => item.id === template.category)?.label[locale] ?? template.category;
  const badges: ('featured' | 'popular' | 'new')[] = [];
  if (template.featured) badges.push('featured');
  if (template.popular) badges.push('popular');
  if (template.isNew) badges.push('new');

  return (
    <motion.article
      data-template-card={template.id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: .5 }}
      className="group flex h-full flex-col"
    >
      <div className="relative">
        <Link href={`/templates/${template.id}`} aria-label={`${template.name[locale]} — ${t('templatesPage', 'details')}`}>
          <TemplateArt template={template} locale={locale} />
        </Link>
        <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-moss backdrop-blur">{category}</span>
        {badges.length > 0 && (
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5">
            {badges.map((key) => (
              <span key={key} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-ivory">
                {key === 'featured' && <Sparkles size={11} aria-hidden="true" />}
                {t('templatesPage', key)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <Link href={`/templates/${template.id}`} className="w-fit group-hover:underline group-hover:decoration-moss group-hover:underline-offset-4">
          <h2 className="font-display text-2xl">{template.name[locale]}</h2>
        </Link>
        <p className="mt-1 text-sm italic text-ink/55">{template.tagline[locale]}</p>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/65">{template.description[locale]}</p>
        <p className="mt-3 text-xs text-ink/45">{t('templatesPage', 'sectionCount').replace('{count}', String(template.sections.length))}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-sm font-semibold">
          <Link href={`/templates/${template.id}`} className="inline-flex items-center gap-1 text-ink/70 hover:text-moss">
            {t('templatesPage', 'details')} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          {template.hasDemo && (
            <Link data-demo-link href={`/demo/${template.id}`} className="text-moss underline-offset-4 hover:underline">
              {t('templatesPage', 'demo')}
            </Link>
          )}
          <Link href={`/create?template=${template.id}`} className="rounded-full bg-moss px-4 py-2 text-xs text-ivory transition hover:bg-ink">
            {t('templatesPage', 'create')}
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
