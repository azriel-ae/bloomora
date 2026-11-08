import type { Ref } from 'react';
import Image from 'next/image';
import type { QrisDisplayConfig } from '@/lib/commerce';

type Props = {
  config: QrisDisplayConfig;
  imageSrc: string | null;
  imageAlt: string;
  cardRef?: Ref<HTMLDivElement>;
};

export function QrisPaymentCard({ config, imageSrc, imageAlt, cardRef }: Props) {
  const isCard = config.frameStyle === 'card';
  return <div
    ref={cardRef}
    data-qris-payment-card="true"
    className={`relative mx-auto w-full max-w-[340px] overflow-hidden p-5 text-center ${isCard ? 'shadow-sm' : ''}`}
    style={{ backgroundColor: config.backgroundColor, border: `2px solid ${config.borderColor}`, borderRadius: isCard ? 26 : 12, color: config.accentColor }}
  >
    <div className="relative z-10 flex min-h-7 items-center justify-center gap-2">
      {config.logoUrl === '/favicon.svg' && <Image src="/favicon.svg" alt="" aria-hidden="true" width={24} height={24} unoptimized className="size-6 object-contain" />}
      {config.logoUrl && <span className="font-display text-sm font-semibold tracking-wide">Bloomora</span>}
    </div>
    {config.decoration === 'petals' && <div aria-hidden="true" className="pointer-events-none absolute right-4 top-4 z-0 flex gap-1 opacity-35"><span className="size-2 rounded-full" style={{ backgroundColor: config.accentColor }} /><span className="mt-2 size-2 rounded-full" style={{ backgroundColor: config.accentColor }} /><span className="size-2 rounded-full" style={{ backgroundColor: config.accentColor }} /></div>}
    {config.decoration === 'ribbon' && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-14 rounded-full" style={{ backgroundColor: config.accentColor, opacity: 0.4 }} />}
    <h3 className="relative z-10 mt-2 font-display text-xl leading-tight">{config.title || 'Scan untuk membayar'}</h3>
    <p className="mx-auto mt-2 max-w-[260px] text-xs leading-5 opacity-75">{config.description}</p>
    <div className="mx-auto mt-4 grid aspect-square w-full max-w-[250px] place-items-center bg-white p-3" style={{ border: `1px solid ${config.borderColor}`, borderRadius: isCard ? 14 : 4 }}>
      {imageSrc
        ? <Image src={imageSrc} alt={imageAlt} width={250} height={250} unoptimized className="block max-h-full max-w-full object-contain" />
        : <span className="px-4 text-xs leading-5 text-ink/45">Unggah dan validasi gambar QRIS untuk melihat pratinjau.</span>}
    </div>
    <p className="mx-auto mt-4 max-w-[270px] text-xs font-semibold leading-5 opacity-75">{config.footer}</p>
  </div>;
}
