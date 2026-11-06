'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Pencil, Trash2 } from 'lucide-react';
import type { AdminPaymentMethod } from '@/lib/server/services';

type Copy = {
  add: string; edit: string; id: string; name: string; instructions: string; active: string; order: string;
  save: string; cancel: string; enabled: string; disabled: string; empty: string; note: string; saved: string;
  failed: string; idHelp: string; paymentType: string; bankTransfer: string; eWallet: string; qris: string; other: string;
  providerName: string; accountNumber: string; accountHolder: string;
};
type Form = Omit<AdminPaymentMethod, 'sortOrder'> & { sortOrder?: number };
const blank = (): Form => ({ id: '', name: '', instructions: '', active: true, paymentType: 'other', providerName: null, accountNumber: null, accountHolder: null, imageUrl: null, imagePath: null });

export function PaymentMethodsManager({ initialMethods, copy }: { initialMethods: AdminPaymentMethod[]; copy: Copy }) {
  const [methods, setMethods] = useState(initialMethods);
  const [form, setForm] = useState<Form>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const newImagePathRef = useRef<string | null>(null);
  const replacedImagePathRef = useRef<string | null>(null);

  function beginEdit(method: AdminPaymentMethod) { setForm({ ...method }); setEditingId(method.id); setMessage(''); }
  async function deleteImage(path: string) {
    try {
      const response = await fetch('/api/admin/payment-methods/image', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) });
      return response.ok;
    } catch { return false; }
  }
  function reset() {
    if (newImagePathRef.current) void deleteImage(newImagePathRef.current);
    newImagePathRef.current = null; replacedImagePathRef.current = null;
    setForm(blank()); setEditingId(null); setMessage(''); if (fileRef.current) fileRef.current.value = '';
  }
  async function upload(file: File) {
    setUploading(true); setMessage('');
    try {
      const data = new FormData(); data.append('file', file);
      const response = await fetch('/api/admin/payment-methods/image', { method: 'POST', body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(String(result.code ?? 'upload_failed'));
      if (newImagePathRef.current) await deleteImage(newImagePathRef.current);
      newImagePathRef.current = String(result.path);
      setForm((current) => ({ ...current, imageUrl: String(result.url), imagePath: String(result.path) }));
    } catch (error) { setMessage(`Pengunggahan gambar gagal${error instanceof Error ? ` (${error.message})` : ''}.`); }
    finally { setUploading(false); }
  }
  async function removeImage() {
    const oldPath = form.imagePath;
    if (oldPath && newImagePathRef.current === oldPath) {
      await deleteImage(oldPath); newImagePathRef.current = null;
    } else if (oldPath) replacedImagePathRef.current = oldPath;
    setForm((current) => ({ ...current, imageUrl: null, imagePath: null }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploading) return;
    savingRef.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/payment-methods', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, id: editingId ?? undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.method) {
        if (newImagePathRef.current) {
          const path = newImagePathRef.current; const cleaned = await deleteImage(path); newImagePathRef.current = null;
          setForm((current) => current.imagePath === path ? { ...current, imageUrl: null, imagePath: null } : current);
          if (!cleaned) setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''} (pembersihan gambar gagal)`);
          else setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`);
        } else setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`);
        return;
      }
      const saved = data.method as AdminPaymentMethod;
      setMethods((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
      newImagePathRef.current = null; replacedImagePathRef.current = null;
      // Existing orders may have frozen this public QR URL. Retain replaced files so
      // their payment instructions remain consistent; cleanup requires reference tracking.
      setMessage(copy.saved); setForm(blank()); setEditingId(null);
    } catch (error) {
      if (newImagePathRef.current) {
        const path = newImagePathRef.current; const cleaned = await deleteImage(path); newImagePathRef.current = null;
        setForm((current) => current.imagePath === path ? { ...current, imageUrl: null, imagePath: null } : current);
        setMessage(`${copy.failed} (${error instanceof Error ? error.message : 'network_error'})${cleaned ? '' : ' (pembersihan gambar gagal)'}`);
      } else setMessage(`${copy.failed} (kesalahan_jaringan)`);
    } finally { savingRef.current = false; setBusy(false); }
  }
  const type = form.paymentType ?? 'other';
  const paymentTypeLabel: Record<string, string> = { bank_transfer: 'Transfer bank', e_wallet: 'Dompet elektronik', qris: 'QRIS', other: 'Lainnya' };
  return <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
    <section aria-label={copy.add} className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">{editingId ? copy.edit : copy.add}</p><h2 className="mt-2 font-display text-3xl">{editingId ? copy.edit : copy.add}</h2></div><span className="grid size-10 place-items-center rounded-2xl bg-sage/20 text-moss"><ImagePlus size={19} /></span></div><p className="mt-3 text-sm leading-6 text-ink/60">{copy.note}</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]"><p className="rounded-xl bg-ivory px-4 py-3 text-xs leading-5 text-ink/55">{editingId ? `ID internal: ${editingId}` : "ID metode dibuat otomatis saat disimpan"}</p><label className="block text-sm font-semibold">{copy.name}<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm focus:border-moss focus:outline-none" /></label></div>
        <label className="block text-sm font-semibold">{copy.paymentType}<select value={type} onChange={(event) => setForm({ ...form, paymentType: event.target.value as Form['paymentType'] })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm"><option value="bank_transfer">{copy.bankTransfer}</option><option value="e_wallet">{copy.eWallet}</option><option value="qris">{copy.qris}</option><option value="other">{copy.other}</option></select></label>
        {(type === 'bank_transfer' || type === 'e_wallet') && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">{copy.providerName}<input required maxLength={120} value={form.providerName ?? ''} onChange={(event) => setForm({ ...form, providerName: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label><label className="block text-sm font-semibold">{copy.accountNumber}<input required maxLength={120} value={form.accountNumber ?? ''} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label>{type === 'bank_transfer' && <label className="block text-sm font-semibold sm:col-span-2">{copy.accountHolder}<input required maxLength={120} value={form.accountHolder ?? ''} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label>}</div>}
        <label className="block text-sm font-semibold">{copy.instructions}<textarea maxLength={2000} rows={4} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} className="mt-2 w-full resize-y rounded-xl border border-line bg-ivory px-4 py-3 text-sm leading-6 focus:border-moss focus:outline-none" /></label>
        <div className="grid gap-5 sm:grid-cols-2"><p className="rounded-xl bg-ivory px-4 py-3 text-xs leading-5 text-ink/55">{copy.order}: {editingId ? `#${form.sortOrder ?? 0}` : 'otomatis'}</p><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="size-4 accent-[#66745d]" />{copy.active}</label></div>
        <div><p className="text-sm font-semibold">Gambar pembayaran <span className="font-normal text-ink/45">(opsional · JPG, PNG, WEBP · maks. 5 MB)</span></p><div className="mt-2 flex flex-wrap items-start gap-4">{form.imageUrl ? <div className="relative overflow-hidden rounded-2xl border border-line bg-ivory p-2"><img src={form.imageUrl} alt="Pratinjau metode pembayaran" className="h-36 w-36 object-contain" /><button type="button" onClick={() => void removeImage()} className="absolute right-2 top-2 rounded-full bg-paper p-2 text-ink/60 shadow" aria-label="Hapus gambar pembayaran"><Trash2 size={15} /></button></div> : <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-ivory text-xs font-semibold text-ink/55 hover:border-moss hover:text-moss"><ImagePlus size={20} />{uploading ? 'Mengunggah…' : 'Tambah gambar'}</button>}<input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></div></div>
        {message && <p role="status" className="rounded-xl bg-ivory px-4 py-3 text-sm">{message}</p>}<div className="flex flex-wrap gap-3"><button disabled={busy || uploading} className="rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? 'Menyimpan…' : copy.save}</button>{editingId && <button type="button" onClick={reset} className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">{copy.cancel}</button>}</div>
      </form></section>
    <section aria-label={copy.name}><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">Metode yang dikonfigurasi</p><h2 className="mt-2 font-display text-3xl">{copy.name}</h2></div><span className="rounded-full bg-sage/20 px-3 py-1 text-xs font-bold text-moss">{methods.length} metode</span></div>{methods.length === 0 ? <p className="mt-5 rounded-2xl border border-line bg-paper p-6 text-sm text-ink/55">{copy.empty}</p> : <ul className="mt-5 space-y-3">{methods.map((method) => <li key={method.id} className="rounded-3xl border border-line bg-paper p-5 shadow-sm"><div className="flex items-start gap-4">{method.imageUrl ? <img src={method.imageUrl} alt="" className="size-16 shrink-0 rounded-2xl border border-line bg-ivory object-contain p-1" /> : <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ivory text-ink/30"><CreditCardIcon /></div>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{method.name}</p><p className="mt-1 font-mono text-xs text-ink/45">{method.id} · {paymentTypeLabel[method.paymentType ?? 'other'] ?? 'Lainnya'} · #{method.sortOrder}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${method.active ? 'bg-sage/30 text-moss' : 'bg-ivory text-ink/50'}`}>{method.active ? copy.enabled : copy.disabled}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink/65">{method.providerName ? `${method.providerName}${method.accountNumber ? ` · ${method.accountNumber}` : ''}` : method.instructions || '—'}</p><button type="button" onClick={() => beginEdit(method)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-xs font-semibold"><Pencil size={14} />{copy.edit}</button></div></div></li>)}</ul>}</section>
  </div>;
}
function CreditCardIcon() { return <span className="text-xl">▭</span>; }
