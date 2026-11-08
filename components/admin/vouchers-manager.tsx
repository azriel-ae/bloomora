'use client';

import { useState } from 'react';
import type { VoucherDoc } from '@/lib/commerce';

type Copy = {
  title: string; intro: string; add: string; edit: string; code: string; kind: string; percent: string; fixed: string;
  value: string; starts: string; expires: string; unlimited: string; maxUses: string; used: string; minimum: string;
  active: string; save: string; cancel: string; saved: string; failed: string; remove: string; deleted: string;
  enabled: string; disabled: string; confirmDelete: string; percentSymbol: string;
};

type VoucherRow = VoucherDoc & { deleted?: boolean };
type Form = { code: string; active: boolean; kind: 'percent' | 'fixed'; value: number; starts: string; expires: string; maxUses: string; minimum: number };

const blank = (): Form => ({ code: '', active: true, kind: 'percent', value: 10, starts: '', expires: '', maxUses: '', minimum: 0 });
const localDateValue = (value: number | null) => value == null ? '' : new Date(value - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const epochValue = (value: string) => value ? new Date(value).getTime() : null;

export function VouchersManager({ initialVouchers, copy }: { initialVouchers: VoucherRow[]; copy: Copy }) {
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function reset() { setForm(blank()); setEditing(null); setMessage(''); }
  function beginEdit(row: VoucherRow) {
    const discount = row.discount;
    setForm({ code: row.code, active: row.active, kind: discount.kind, value: discount.kind === 'percent' ? discount.value : discount.valueIdr, starts: localDateValue(row.startsAtMs), expires: localDateValue(row.expiresAtMs), maxUses: row.maxUses == null ? '' : String(row.maxUses), minimum: row.minimumAmountIdr });
    setEditing(row.code); setMessage('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const discount = form.kind === 'percent' ? { kind: 'percent', value: Number(form.value) } : { kind: 'fixed', valueIdr: Number(form.value) };
    const payload = { code: form.code, active: form.active, discount, startsAtMs: epochValue(form.starts), expiresAtMs: epochValue(form.expires), maxUses: form.maxUses.trim() === '' ? null : Number(form.maxUses), minimumAmountIdr: Number(form.minimum) };
    try {
      const response = await fetch('/api/admin/vouchers', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.voucher) { setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`); return; }
      const saved = data.voucher as VoucherRow;
      setVouchers((current) => [...current.filter((item) => item.code !== saved.code), saved].sort((a, b) => a.code.localeCompare(b.code)));
      setMessage(copy.saved); setForm(blank()); setEditing(null);
    } catch { setMessage(copy.failed); }
    finally { setBusy(false); }
  }

  async function remove(code: string) {
    if (!window.confirm(copy.confirmDelete)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/vouchers', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`); return; }
      setVouchers((current) => current.map((item) => item.code === code ? { ...item, active: false, deleted: true } : item));
      if (editing === code) reset();
      setMessage(copy.deleted);
    } catch { setMessage(copy.failed); }
    finally { setBusy(false); }
  }

  return <div className="mt-8 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
    <section><h2 className="font-display text-2xl">{copy.title}</h2><ul className="mt-4 space-y-3">{vouchers.map((row) => <li key={row.code} className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono font-semibold">{row.code}</p><p className="mt-1 text-xs text-ink/50">{row.discount.kind === 'percent' ? `${row.discount.value}${copy.percentSymbol}` : `${row.discount.valueIdr.toLocaleString()} IDR`} · {copy.used}: {row.usedCount}{row.maxUses == null ? ` / ${copy.unlimited}` : ` / ${row.maxUses}`}</p></div><span className="rounded-full bg-ivory px-3 py-1 text-xs text-ink/55">{row.deleted ? copy.deleted : row.active ? copy.enabled : copy.disabled}</span></div>
      <p className="mt-2 text-xs text-ink/50">{copy.minimum}: {row.minimumAmountIdr.toLocaleString()} IDR</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => beginEdit(row)} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">{copy.edit}</button>{!row.deleted && <button type="button" disabled={busy} onClick={() => void remove(row.code)} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-50">{copy.remove}</button>}</div>
    </li>)}</ul></section>
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h2 className="font-display text-2xl">{editing ? copy.edit : copy.add}</h2><p className="text-sm leading-6 text-ink/55">{copy.intro}</p>
      <label className="block text-sm font-semibold">{copy.code}<input required disabled={Boolean(editing)} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}" maxLength={40} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-mono" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">{copy.kind}<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Form['kind'] })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3"><option value="percent">{copy.percent}</option><option value="fixed">{copy.fixed}</option></select></label>
        <label className="block text-sm font-semibold">{copy.value}<input required type="number" min={1} max={form.kind === 'percent' ? 100 : 100000000} step={1} value={form.value} onChange={(event) => setForm({ ...form, value: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.starts}<input type="datetime-local" value={form.starts} onChange={(event) => setForm({ ...form, starts: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.expires}<input type="datetime-local" value={form.expires} onChange={(event) => setForm({ ...form, expires: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.maxUses}<input type="number" min={1} step={1} value={form.maxUses} placeholder={copy.unlimited} onChange={(event) => setForm({ ...form, maxUses: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
        <label className="block text-sm font-semibold">{copy.minimum}<input required type="number" min={0} max={100000000} step={1} value={form.minimum} onChange={(event) => setForm({ ...form, minimum: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3" /></label>
      </div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="size-4 accent-[#536c51]" />{copy.active}</label>
      {message && <p role="status" className="rounded-xl bg-ivory px-4 py-3 text-sm">{message}</p>}
      <div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? '…' : copy.save}</button>{editing && <button type="button" onClick={reset} className="rounded-full border border-line px-5 py-3 text-sm font-semibold">{copy.cancel}</button>}</div>
    </form>
  </div>;
}
