'use client';

import { useLocale } from './locale-provider';

/** Text-only language toggle for the demo's top bar (the site header is hidden on demo pages). */
export function DemoLanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="bl-lang" role="group" aria-label={t('navigation', 'language')}>
      {(['id', 'en'] as const).map((l) => (
        <button key={l} type="button" className="bl-nav-btn" aria-pressed={locale === l} lang={l} onClick={() => locale !== l && setLocale(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
