'use client';

import { useLocale } from '@/components/locale-provider';

export default function TemplatesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLocale();
  return (
    <section role="alert" className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('templatesPage', 'eyebrow')}</p>
      <h1 className="mt-4 font-display text-4xl">{t('templatesPage', 'loadError')}</h1>
      <p className="mt-4 text-sm leading-6 text-ink/60">{t('templatesPage', 'loadErrorBody')}</p>
      <button type="button" onClick={reset} className="mt-7 rounded-full bg-moss px-6 py-3 text-sm font-semibold text-ivory">{t('templatesPage', 'retry')}</button>
    </section>
  );
}
