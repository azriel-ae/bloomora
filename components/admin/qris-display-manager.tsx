'use client';

import { useState } from 'react';
import type { QrisDisplayConfig } from '@/lib/commerce';

type Props = { initial: QrisDisplayConfig; qrisImageUrl: string | null };

export function QrisDisplayManager({ initial, qrisImageUrl }: Props) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = <K extends keyof QrisDisplayConfig>(key: K, value: QrisDisplayConfig[K]) => setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/payment-methods/qris-display', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.qrisDisplay) throw new Error(String(data.code ?? 'save_failed'));
      setSaved(data.qrisDisplay); setDraft(data.qrisDisplay); setMessage('QRIS display settings saved.');
    } catch { setMessage('QRIS settings could not be saved.'); }
    finally { setBusy(false); }
  }
  function reset() { setDraft(saved); setMessage(''); }
  return <section className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8" aria-label="QRIS display settings">
    <div><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">Bloomora payment experience</p><h2 className="mt-2 font-display text-3xl">QRIS display settings</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Style the area around the original QR image. The QR modules and quiet zone are never redrawn, recolored, covered, cropped, or stretched.</p></div>
    <div className="mt-7 grid gap-7 xl:grid-cols-[1fr_340px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Title<input value={draft.title} maxLength={100} onChange={(event) => update('title', event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold sm:col-span-2">Description<textarea value={draft.description} maxLength={300} rows={3} onChange={(event) => update('description', event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold">Background<input type="color" value={draft.backgroundColor} onChange={(event) => update('backgroundColor', event.target.value)} className="mt-2 block h-11 w-full rounded-xl border border-line bg-ivory p-1" /></label>
        <label className="text-sm font-semibold">Accent<input type="color" value={draft.accentColor} onChange={(event) => update('accentColor', event.target.value)} className="mt-2 block h-11 w-full rounded-xl border border-line bg-ivory p-1" /></label>
        <label className="text-sm font-semibold">Border<input type="color" value={draft.borderColor} onChange={(event) => update('borderColor', event.target.value)} className="mt-2 block h-11 w-full rounded-xl border border-line bg-ivory p-1" /></label>
        <label className="text-sm font-semibold">Frame<select value={draft.frameStyle} onChange={(event) => update('frameStyle', event.target.value as QrisDisplayConfig['frameStyle'])} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-normal"><option value="card">Bloomora card</option><option value="minimal">Minimal</option></select></label>
        <label className="text-sm font-semibold">Decoration<select value={draft.decoration} onChange={(event) => update('decoration', event.target.value as QrisDisplayConfig['decoration'])} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-normal"><option value="none">None</option><option value="petals">Soft petals</option><option value="ribbon">Ribbon accent</option></select></label>
        <label className="text-sm font-semibold sm:col-span-2">Footer<input value={draft.footer} maxLength={160} onChange={(event) => update('footer', event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-normal" /></label>
        {message && <p role="status" className="sm:col-span-2 rounded-xl bg-ivory px-4 py-3 text-sm">{message}</p>}
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button><button type="button" disabled={busy} onClick={reset} className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">Reset</button></div>
      </div>
      <QrisPreview config={draft} imageUrl={qrisImageUrl} />
    </div>
  </section>;
}

function QrisPreview({ config, imageUrl }: { config: QrisDisplayConfig; imageUrl: string | null }) {
  return <div className="rounded-3xl border border-line bg-ivory p-4"><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-moss">Live preview</p><div className={`relative overflow-hidden p-5 text-center ${config.frameStyle === 'card' ? 'rounded-3xl shadow-sm' : 'rounded-xl'}`} style={{ backgroundColor: config.backgroundColor, border: `2px solid ${config.borderColor}`, color: config.accentColor }}>{config.decoration !== 'none' && <span aria-hidden className="pointer-events-none absolute right-3 top-2 text-2xl opacity-35">{config.decoration === 'petals' ? '✦' : '⌁'}</span>}<h3 className="font-display text-2xl">{config.title || 'Scan untuk membayar'}</h3><p className="mt-2 text-xs leading-5 opacity-75">{config.description}</p><div className="mx-auto mt-4 grid aspect-square max-w-[220px] place-items-center overflow-hidden rounded-xl bg-white p-3" style={{ border: `1px solid ${config.borderColor}` }}>{imageUrl ? <img src={imageUrl} alt="Original QRIS preview" className="h-full w-full object-contain" /> : <span className="text-xs text-ink/45">Upload a QRIS image to preview it</span>}</div><p className="mt-4 text-xs font-semibold opacity-75">{config.footer}</p></div><p className="mt-3 text-[11px] leading-4 text-ink/50">Preview frame only. The original QRIS image remains the scannable source.</p></div>;
}

