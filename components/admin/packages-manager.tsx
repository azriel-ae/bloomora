'use client';

import { useState } from 'react';
import type { PackageDoc, PackageId } from '@/lib/model/types';

type Copy = {
  title: string; name: string; price: string; duration: string; active: string; order: string; maxGifts: string; maxPhotos: string;
  music: string; priority: string; core: string; extended: string; save: string; saved: string; failed: string; note: string;
  enabled: string; disabled: string;
};

export function PackagesManager({ initialPackages, copy }: { initialPackages: PackageDoc[]; copy: Copy }) {
  const [packages, setPackages] = useState(initialPackages);
  const [editingId, setEditingId] = useState<PackageId>(initialPackages[0]?.id ?? 'basic');
  const [values, setValues] = useState<Record<PackageId, PackageDoc>>(() => Object.fromEntries(initialPackages.map((item) => [item.id, item])) as Record<PackageId, PackageDoc>);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const current = values[editingId];

  function update(patch: Partial<PackageDoc>) { setValues((prev) => ({ ...prev, [editingId]: { ...prev[editingId]!, ...patch } })); }
  function updateLimit<K extends keyof PackageDoc['limits']>(key: K, value: PackageDoc['limits'][K]) {
    update({ limits: { ...current.limits, [key]: value } });
  }
  function toggleTier(tier: 'core' | 'extended') {
    const currentTiers = current.limits.allowedTemplateTiers;
    const next = currentTiers.includes(tier) ? currentTiers.filter((item) => item !== tier) : [...currentTiers, tier];
    updateLimit('allowedTemplateTiers', next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/packages', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(current) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.package) { setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`); return; }
      const saved = data.package as PackageDoc;
      setValues((prev) => ({ ...prev, [saved.id]: saved }));
      setPackages((prev) => prev.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.sortOrder - b.sortOrder));
      setMessage(copy.saved);
    } catch { setMessage(copy.failed); }
    finally { setBusy(false); }
  }

  return <div className="mt-8 grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
    <section><h2 className="font-display text-2xl">{copy.title}</h2><ul className="mt-4 space-y-3">{packages.map((item) => <li key={item.id}><button type="button" onClick={() => { setEditingId(item.id); setMessage(''); }} className={`w-full rounded-2xl border p-5 text-left ${editingId === item.id ? 'border-moss bg-sage/20' : 'border-line bg-paper'}`}><span className="flex items-center justify-between gap-3"><span className="font-semibold">{item.name}</span><span className="text-xs text-ink/50">{item.active ? copy.enabled : copy.disabled}</span></span><span className="mt-2 block text-xs text-ink/50">{item.id} · #{item.sortOrder}</span></button></li>)}</ul></section>
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h2 className="font-display text-2xl">{current.name}</h2><p className="text-sm leading-6 text-ink/55">{copy.note}</p>
      <label className="block text-sm font-semibold">{copy.name}<input required maxLength={80} value={current.name} onChange={(event) => update({ name: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">{copy.price}<input required type="number" min={1} max={100000000} step={1} value={current.priceIdr} onChange={(event) => update({ priceIdr: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.duration}<input required type="number" min={1} max={366} step={1} value={current.durationDays} onChange={(event) => update({ durationDays: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.maxGifts}<input required type="number" min={1} max={1000} step={1} value={current.limits.maxGifts} onChange={(event) => updateLimit('maxGifts', Number(event.target.value))} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.maxPhotos}<input required type="number" min={0} max={500} step={1} value={current.limits.maxPhotos} onChange={(event) => updateLimit('maxPhotos', Number(event.target.value))} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.order}<input required type="number" min={0} max={9999} step={1} value={current.sortOrder} onChange={(event) => update({ sortOrder: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
      </div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={current.active} onChange={(event) => update({ active: event.target.checked })} className="size-4 accent-[#536c51]" />{copy.active}</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={current.limits.music} onChange={(event) => updateLimit('music', event.target.checked)} className="size-4 accent-[#536c51]" />{copy.music}</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={current.limits.priorityReview} onChange={(event) => updateLimit('priorityReview', event.target.checked)} className="size-4 accent-[#536c51]" />{copy.priority}</label>
      <fieldset><legend className="text-sm font-semibold">Jenjang template</legend><div className="mt-3 flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.limits.allowedTemplateTiers.includes('core')} onChange={() => toggleTier('core')} className="size-4 accent-[#536c51]" />{copy.core}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.limits.allowedTemplateTiers.includes('extended')} onChange={() => toggleTier('extended')} className="size-4 accent-[#536c51]" />{copy.extended}</label></div></fieldset>
      {message && <p role="status" className="rounded-xl bg-ivory px-4 py-3 text-sm">{message}</p>}
      <button disabled={busy} className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? '…' : copy.save}</button>
    </form>
  </div>;
}
