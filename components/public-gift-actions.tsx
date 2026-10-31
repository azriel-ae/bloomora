'use client';

import { Check, Copy, QrCode, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function PublicGiftActions({ labels }: { labels: { copy: string; share: string; qr: string; copied: string; close: string } }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: document.title, url: window.location.href }).catch(() => undefined);
    else await copyLink();
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="bl-nav-btn" onClick={() => void copyLink()} aria-label={copied ? labels.copied : labels.copy}>
          {copied ? <Check /> : <Copy />}<span>{copied ? labels.copied : labels.copy}</span>
        </button>
        <button type="button" className="bl-nav-btn" onClick={() => void share()} aria-label={labels.share}><Share2 /><span>{labels.share}</span></button>
        <button type="button" className="bl-nav-btn" onClick={() => setShowQr(true)} aria-label={labels.qr}><QrCode /><span>{labels.qr}</span></button>
      </div>
      {showQr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5" role="dialog" aria-modal="true" aria-label={labels.qr}>
          <div className="rounded-3xl bg-paper p-6 text-center shadow-paper">
            <QRCodeSVG value={typeof window === 'undefined' ? '' : window.location.href} size={220} bgColor="#fffdf8" fgColor="#27352b" includeMargin />
            <button type="button" className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold" onClick={() => setShowQr(false)}><X size={15} />{labels.close}</button>
          </div>
        </div>
      )}
    </>
  );
}
