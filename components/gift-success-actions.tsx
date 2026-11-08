'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, QrCode, Share2 } from 'lucide-react';
import { QrDesigner } from '@/components/qr-designer';

type Copy = {
  publishedSuccess: string; publicLink: string; copyPublicLink: string; copied: string; openGift: string;
  shareGift: string; giftQr: string; close: string; editLinkLabel: string; editLinkWarning: string;
  copyEditLink: string; editLinkCopied: string;
  qrDescription: string; qrForeground: string; qrBackground: string; qrDownloadPng: string; qrDownloadSvg: string;
};

async function copyText(value: string) {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const input = document.createElement('input'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
  }
}

export function GiftSuccessActions({ publicUrl, editUrl, copy }: { publicUrl: string; editUrl?: string; copy: Copy }) {
  const [publicCopied, setPublicCopied] = useState(false);
  const [editCopied, setEditCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  async function share() {
    if (navigator.share) await navigator.share({ title: document.title, url: publicUrl }).catch(() => undefined);
    else await copyText(publicUrl);
  }
  async function copyPublic() {
    await copyText(publicUrl); setPublicCopied(true); window.setTimeout(() => setPublicCopied(false), 1800);
  }
  async function copyEdit() {
    if (!editUrl) return;
    await copyText(editUrl); setEditCopied(true); window.setTimeout(() => setEditCopied(false), 1800);
  }
  return <section className="mt-6 rounded-3xl border border-line bg-paper p-6 shadow-soft sm:p-8">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{copy.publishedSuccess}</p>
    <h2 className="mt-2 font-display text-3xl">{copy.publicLink}</h2>
    <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all rounded-2xl bg-ivory p-4 font-mono text-sm text-moss">{publicUrl}</a>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => void copyPublic()} className="inline-flex items-center gap-2 rounded-full bg-moss px-4 py-2.5 text-sm font-semibold text-ivory">{publicCopied ? <Check size={16} /> : <Copy size={16} />}{publicCopied ? copy.copied : copy.copyPublicLink}</button>
      <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold"><ExternalLink size={16} />{copy.openGift}</a>
      <button type="button" onClick={() => void share()} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold"><Share2 size={16} />{copy.shareGift}</button>
      <button type="button" onClick={() => setShowQr(true)} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold"><QrCode size={16} />{copy.giftQr}</button>
    </div>
    {editUrl && <div className="mt-6 rounded-2xl border border-[#d4b875] bg-[#faf2dc] p-4"><h3 className="text-sm font-semibold">{copy.editLinkLabel}</h3><p className="mt-2 break-all font-mono text-xs text-ink/70">{editUrl}</p><p className="mt-2 text-xs leading-5 text-ink/60">{copy.editLinkWarning}</p><button type="button" onClick={() => void copyEdit()} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold">{editCopied ? <Check size={15} /> : <Copy size={15} />}{editCopied ? copy.editLinkCopied : copy.copyEditLink}</button></div>}
    {showQr && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5" role="dialog" aria-modal="true" aria-label={copy.giftQr}><QrDesigner value={publicUrl} labels={{ description: copy.qrDescription, foreground: copy.qrForeground, background: copy.qrBackground, downloadPng: copy.qrDownloadPng, downloadSvg: copy.qrDownloadSvg, close: copy.close }} onClose={() => setShowQr(false)} /></div>}
  </section>;
}
