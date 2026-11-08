'use client';

import Link from 'next/link';
import { Menu, X, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocale } from './locale-provider';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [demoHref, setDemoHref] = useState('/demo');
  const { t } = useLocale();
  const close = () => setOpen(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/featured-demo', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { templateId?: unknown } | null) => {
        if (active && typeof data?.templateId === 'string' && /^[a-z0-9-]+$/.test(data.templateId)) {
          setDemoHref(`/demo/${data.templateId}`);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ivory/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="group flex items-center gap-2" onClick={close}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-moss text-ivory transition-transform group-hover:rotate-6"><Sprout size={17} strokeWidth={1.6} /></span>
          <span className="font-display text-xl tracking-tight">Bloomora</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-ink/70 md:flex">
          <Link href="/templates" className="transition-colors hover:text-ink">{t('navigation', 'templates')}</Link>
          <Link href="/pricing" className="transition-colors hover:text-ink">{t('navigation', 'pricing')}</Link>
          <Link href="/about" className="transition-colors hover:text-ink">{t('navigation', 'story')}</Link>
          <Link href={demoHref} className="font-semibold text-moss transition-colors hover:text-ink">{t('navigation', 'demo')}</Link>
          <Link href="/faq" className="transition-colors hover:text-ink">{t('navigation', 'faq')}</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="https://bloomora.my.id/templates" className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ivory shadow-soft transition hover:-translate-y-0.5 hover:bg-ink">{t('navigation', 'createGift')}</Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button type="button" aria-label={open ? t('common', 'close') : 'Buka menu'} className="rounded-full p-2 text-ink" onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>
      {open && <div className="border-t border-line bg-paper px-5 py-5 md:hidden"><nav className="flex flex-col gap-1 text-base">
        <Link className="rounded-xl px-3 py-3 hover:bg-ivory" href="/templates" onClick={close}>{t('navigation', 'templates')}</Link>
        <Link className="rounded-xl px-3 py-3 hover:bg-ivory" href="/pricing" onClick={close}>{t('navigation', 'pricing')}</Link>
        <Link className="rounded-xl px-3 py-3 hover:bg-ivory" href="/about" onClick={close}>{t('navigation', 'story')}</Link>
        <Link className="rounded-xl px-3 py-3 font-semibold text-moss hover:bg-ivory" href={demoHref} onClick={close}>{t('navigation', 'demo')}</Link>
        <Link className="rounded-xl px-3 py-3 hover:bg-ivory" href="/faq" onClick={close}>{t('navigation', 'faq')}</Link>
        <Link className="mt-3 rounded-full bg-moss px-4 py-3 text-center font-semibold text-ivory" href="https://bloomora.my.id/templates" onClick={close}>{t('navigation', 'createGift')}</Link>
      </nav></div>}
    </header>
  );
}
