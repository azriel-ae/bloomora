'use client';

import { Check, ExternalLink, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from './locale-provider';

export function PublishDialog({ giftId, expectedVersion, disabled }: { giftId: string; expectedVersion: number; disabled: boolean }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const publish = async () => {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/gifts/${encodeURIComponent(giftId)}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || typeof data.slug !== 'string') { setError(true); return; }
      setUrl(`${window.location.origin}/g/${data.slug}`);
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <>
    <button type="button" disabled={disabled} onClick={() => { setOpen(true); setUrl(null); setError(false); }} className="inline-flex items-center gap-2 rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50" data-publish-gift><Send size={15} />{t('editor', 'publish')}</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title"><div className="w-full max-w-md rounded-3xl border border-line bg-paper p-6 shadow-paper">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('editor', 'publish')}</p><h2 id="publish-dialog-title" className="mt-2 font-display text-2xl">{url ? t('editor', 'published') : t('editor', 'publishConfirm')}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label={t('common', 'close')}><X size={18} /></button></div>
      {!url ? <><p className="mt-4 text-sm leading-6 text-ink/65">{t('editor', 'publishBody')}</p>{error && <p className="mt-3 text-sm text-rose" role="alert">{t('editor', 'publishFailed')}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-2 text-sm">{t('common', 'close')}</button><button type="button" disabled={busy} onClick={() => void publish()} className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? t('editor', 'statusSaving') : t('editor', 'publish')}</button></div></> : <><p className="mt-4 flex items-center gap-2 text-sm text-moss"><Check size={16} />{t('editor', 'publishedBody')}</p><a className="mt-4 block break-all rounded-xl bg-ivory p-3 text-sm text-moss underline" href={url}>{url}</a><div className="mt-6 flex justify-end"><a href={url} className="inline-flex items-center gap-2 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-ivory"><ExternalLink size={15} />{t('editor', 'openGift')}</a></div></>}
    </div></div>}
  </>;
}
