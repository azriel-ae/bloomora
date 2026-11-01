'use client';

import { Check, Copy, QrCode, Share2 } from 'lucide-react';
import { useState } from 'react';
import { QrDesigner } from './qr-designer';

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
          <QrDesigner value={typeof window === 'undefined' ? '' : window.location.href} closeLabel={labels.close} onClose={() => setShowQr(false)} />
        </div>
      )}
    </>
  );
}
