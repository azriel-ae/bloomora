'use client';

import Link from 'next/link';
import { Check, ArrowUpRight } from 'lucide-react';
import type { PackageDoc } from '@/lib/model/types';
import { useLocale } from './locale-provider';
import { formatRupiah } from '@/lib/i18n-core';

const descriptions: Record<string, { id: string; en: string }> = {
  basic: { id: 'Momen kecil yang manis untuk ulang tahun, ucapan terima kasih, atau sekadar ingin berkata: aku memikirkanmu.', en: 'A sweet little moment for a birthday, thank-you, or just because.' },
  plus: { id: 'Ruang lebih luas untuk cerita, timeline, dan semua detail yang layak disimpan.', en: 'More room for a story, a timeline, and all the details worth keeping.' },
  premium: { id: 'Satu bulan penuh untuk perasaan besar dan kedekatan yang melintasi jarak.', en: 'A full month for the big feelings and the long-distance kind of close.' },
};

export function PricingPageView({ packages }: { packages: readonly PackageDoc[] }) {
  const { t, locale } = useLocale();
  return <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('pricingPage', 'eyebrow')}</p><h1 className="mt-4 font-display text-5xl sm:text-6xl">{t('pricingPage', 'title')}</h1><p className="mt-5 text-lg leading-8 text-ink/60">{t('pricingPage', 'intro')}</p></div>
    {packages.length === 0 ? <p className="mx-auto mt-14 max-w-2xl rounded-3xl border border-line bg-paper p-8 text-center text-sm text-ink/60">{t('pricingPage', 'empty')}</p> :
      <div className="mt-14 grid gap-4 lg:grid-cols-3">{packages.map((plan, index) => {
        const emphasized = packages.length > 1 && index === 1;
        const features = [
          `${plan.limits.maxGifts} ${t('pricingPage', 'giftLimit')}`,
          `${t('pricingPage', 'photoLimit')}: ${plan.limits.maxPhotos}`,
          ...(plan.limits.allowedTemplateTiers.includes('core') ? [t('pricingPage', 'coreTier')] : []),
          ...(plan.limits.allowedTemplateTiers.includes('extended') ? [t('pricingPage', 'extendedTier')] : []),
          ...(plan.limits.music ? [t('pricingPage', 'musicIncluded')] : []),
          ...(plan.limits.priorityReview ? [t('pricingPage', 'priorityReview')] : []),
          t('pricingPage', 'privateLink'),
        ];
        const copy = descriptions[plan.id]?.[locale] ?? plan.name;
        return <div key={plan.id} className={`relative rounded-[2rem] border p-7 ${emphasized ? 'border-moss bg-moss text-ivory shadow-paper' : 'border-line bg-paper'}`}>
          {emphasized && <span className="absolute right-6 top-6 rounded-full bg-ivory px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-moss">{t('pricingPage', 'mostChosen')}</span>}
          <p className={`text-xs font-bold uppercase tracking-[.18em] ${emphasized ? 'text-sage' : 'text-moss'}`}>{plan.name}</p>
          <p className="mt-8 font-display text-4xl">{formatRupiah(plan.priceIdr, locale)}</p>
          <p className={`mt-1 text-sm ${emphasized ? 'text-ivory/65' : 'text-ink/55'}`}>{t('pricingPage', 'active')} {plan.durationDays} {locale === 'id' ? 'hari' : 'days'}</p>
          <p className={`mt-7 min-h-16 text-sm leading-6 ${emphasized ? 'text-ivory/75' : 'text-ink/60'}`}>{copy}</p>
          <div className={`my-7 h-px ${emphasized ? 'bg-ivory/20' : 'bg-line'}`} />
          <div className="space-y-3">{features.map((feature) => <p key={feature} className="flex gap-2 text-sm"><Check size={16} className={emphasized ? 'text-sage' : 'text-moss'} /> {feature}</p>)}</div>
          <Link href="/create" className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold ${emphasized ? 'bg-ivory text-moss' : 'bg-moss text-ivory'}`}>{t('pricingPage', 'choose')} {plan.name} <ArrowUpRight className="ml-2" size={16} /></Link>
        </div>;
      })}</div>}
    <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-ink/45">{t('pricingPage', 'limits')} {t('pricingPage', 'photoNotice')}</p>
  </div>;
}
