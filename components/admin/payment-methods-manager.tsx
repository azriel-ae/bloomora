'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { isVerifiedQrisImagePath, type QrisDisplayConfig } from '@/lib/commerce';
import type { AdminPaymentMethod } from '@/lib/server/services';
import { QrisDisplayManager } from './qris-display-manager';

type Copy = {
  add: string; edit: string; id: string; name: string; instructions: string; active: string; order: string;
  save: string; cancel: string; enabled: string; disabled: string; empty: string; note: string; saved: string;
  failed: string; idHelp: string; paymentType: string; bankTransfer: string; eWallet: string; qris: string; other: string;
  providerName: string; accountNumber: string; accountHolder: string;
};
type Form = Omit<AdminPaymentMethod, 'sortOrder'> & { sortOrder?: number };
type ManualCrop = { x: number; y: number; width: number; height: number };
type QrisCandidate = { file: File; crop: ManualCrop | null; previewDataUrl: string; width: number; height: number };
const blank = (): Form => ({ id: '', name: '', instructions: '', active: true, paymentType: 'other', providerName: null, accountNumber: null, accountHolder: null, imageUrl: null, imagePath: null, qrisDetectionStatus: 'not_checked' });

function qrisErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    qris_not_found: 'QR tidak terbaca. Unggah ulang atau pilih area QR secara manual.',
    qris_payload_invalid: 'Kode terbaca, tetapi payload atau CRC-nya bukan QRIS Indonesia yang valid.',
    qris_quiet_zone_missing: 'Gambar tidak menyisakan quiet zone minimal 4 modul di sekeliling QR. Gunakan sumber yang lebih longgar.',
    qris_quiet_zone_unclear: 'Ada elemen lain di zona kosong QR. Pilih area QR yang bersih atau unggah gambar sumber lain.',
    qris_alignment_unsupported: 'QR harus tegak dan hampir sejajar dengan sisi gambar. Putar gambar sumber lalu coba lagi.',
    qris_crop_validation_failed: 'Hasil crop belum dapat didekode ulang. Pilih area yang lebih lengkap dan sisakan quiet zone.',
    qris_crop_too_large: 'Hasil crop melebihi batas ukuran. Gunakan gambar sumber beresolusi lebih rendah.',
    invalid_manual_crop: 'Area pilihan manual terlalu kecil atau berada di luar gambar.',
    invalid_image_dimensions: 'Dimensi gambar tidak didukung.',
    invalid_file_type: 'Gunakan gambar JPG, PNG, atau WEBP.',
    file_too_large: 'Ukuran file maksimum 5 MB.',
  };
  return messages[code] ?? 'Gambar QRIS tidak dapat diproses. Periksa kembali file yang dipilih.';
}

export function PaymentMethodsManager({ initialMethods, initialQrisDisplay, copy }: { initialMethods: AdminPaymentMethod[]; initialQrisDisplay: QrisDisplayConfig; copy: Copy }) {
  const [methods, setMethods] = useState(initialMethods);
  const [form, setForm] = useState<Form>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [qrisMessage, setQrisMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [selection, setSelection] = useState<ManualCrop | null>(null);
  const [candidate, setCandidate] = useState<QrisCandidate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewRequestRef = useRef(0);
  const savingRef = useRef(false);
  const newImagePathRef = useRef<string | null>(null);
  const uncertainCommitRef = useRef(false);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  function clearCandidate() {
    previewRequestRef.current += 1;
    setCandidate(null); setSourceUrl(null); setSourceFile(null); setManualMode(false); setSelection(null); setQrisMessage(''); setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteImage(path: string) {
    try {
      const response = await fetch('/api/admin/payment-methods/image', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) });
      return response.ok;
    } catch { return false; }
  }

  function beginEdit(method: AdminPaymentMethod) {
    if (newImagePathRef.current && !uncertainCommitRef.current) void deleteImage(newImagePathRef.current);
    newImagePathRef.current = null; uncertainCommitRef.current = false;
    clearCandidate(); setForm({ ...method }); setEditingId(method.id); setMessage('');
  }

  function reset() {
    if (newImagePathRef.current && !uncertainCommitRef.current) void deleteImage(newImagePathRef.current);
    newImagePathRef.current = null; uncertainCommitRef.current = false;
    clearCandidate(); setForm(blank()); setEditingId(null); setMessage('');
  }

  async function previewQris(file: File, crop: ManualCrop | null, requestId: number) {
    setUploading(true); setQrisMessage(crop ? 'Memeriksa area manual…' : 'Mendeteksi dan memvalidasi QRIS…');
    try {
      const body = new FormData(); body.set('file', file); body.set('mode', 'preview'); body.set('paymentType', 'qris');
      if (crop) body.set('manualCrop', JSON.stringify(crop));
      const response = await fetch('/api/admin/payment-methods/image', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (requestId !== previewRequestRef.current) return;
      if (!response.ok || !result.ok || result.verified !== true || typeof result.previewDataUrl !== 'string') {
        setQrisMessage(qrisErrorMessage(String(result.code ?? 'image_processing_failed')));
        return;
      }
      setCandidate({ file, crop, previewDataUrl: result.previewDataUrl, width: Number(result.width), height: Number(result.height) });
      setQrisMessage(`QRIS tervalidasi. Pratinjau ${Number(result.width)} × ${Number(result.height)} px; belum disimpan sampai tombol “${copy.save}” ditekan.`);
      setManualMode(false); setSelection(null);
    } catch {
      if (requestId === previewRequestRef.current) setQrisMessage('Pratinjau QRIS gagal dimuat. Coba lagi.');
    } finally {
      if (requestId === previewRequestRef.current) setUploading(false);
    }
  }

  async function upload(file: File) {
    if (fileRef.current) fileRef.current.value = '';
    setMessage('');
    if ((form.paymentType ?? 'other') === 'qris') {
      if (file.size > 5 * 1024 * 1024) { setQrisMessage(qrisErrorMessage('file_too_large')); return; }
      const requestId = ++previewRequestRef.current;
      setCandidate(null); setSelection(null); setManualMode(false); setQrisMessage(''); setSourceFile(file); setSourceUrl(URL.createObjectURL(file));
      await previewQris(file, null, requestId);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch('/api/admin/payment-methods/image', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || typeof result.path !== 'string' || typeof result.url !== 'string') throw new Error(String(result.code ?? 'upload_failed'));
      if (newImagePathRef.current && !uncertainCommitRef.current) await deleteImage(newImagePathRef.current);
      newImagePathRef.current = result.path; uncertainCommitRef.current = false;
      setForm((current) => ({ ...current, imageUrl: result.url, imagePath: result.path, qrisDetectionStatus: 'not_checked' }));
    } catch (error) { setMessage(`Pengunggahan gambar gagal${error instanceof Error ? ` (${error.message})` : ''}.`); }
    finally { setUploading(false); }
  }

  async function removeImage() {
    const oldPath = form.imagePath;
    if (oldPath && newImagePathRef.current === oldPath && !uncertainCommitRef.current) {
      await deleteImage(oldPath); newImagePathRef.current = null;
    }
    setForm((current) => ({ ...current, imageUrl: null, imagePath: null, qrisDetectionStatus: current.paymentType === 'qris' ? 'needs_confirmation' : 'not_checked' }));
    clearCandidate();
  }

  function selectionPoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = sourceImageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploading) return;
    savingRef.current = true; setBusy(true); setMessage('');
    let saveForm: Form = form;
    let stagedPath: string | null = form.paymentType !== 'qris' ? newImagePathRef.current : null;
    try {
      if (form.paymentType === 'qris' && candidate) {
        setUploading(true);
        const body = new FormData(); body.set('file', candidate.file); body.set('paymentType', 'qris');
        if (candidate.crop) body.set('manualCrop', JSON.stringify(candidate.crop));
        const imageResponse = await fetch('/api/admin/payment-methods/image', { method: 'POST', body });
        const imageResult = await imageResponse.json().catch(() => ({}));
        if (!imageResponse.ok || !imageResult.ok || imageResult.qrisDetectionStatus !== 'confirmed' || typeof imageResult.path !== 'string' || !isVerifiedQrisImagePath(imageResult.path) || typeof imageResult.url !== 'string') {
          throw new Error(String(imageResult.code ?? 'qris_image_upload_failed'));
        }
        if (newImagePathRef.current && !uncertainCommitRef.current) await deleteImage(newImagePathRef.current);
        newImagePathRef.current = imageResult.path; uncertainCommitRef.current = false; stagedPath = imageResult.path;
        saveForm = { ...form, imageUrl: imageResult.url, imagePath: imageResult.path, qrisDetectionStatus: 'confirmed' };
      }
      const qrisReady = saveForm.paymentType !== 'qris'
        || (saveForm.qrisDetectionStatus === 'confirmed' && isVerifiedQrisImagePath(saveForm.imagePath) && Boolean(saveForm.imageUrl));
      if (saveForm.active && !qrisReady) throw new Error('qris_image_not_confirmed');
      setUploading(false);
      const response = await fetch('/api/admin/payment-methods', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...saveForm, id: editingId ?? undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.method) {
        if (stagedPath) {
          const path = stagedPath;
          const cleaned = await deleteImage(path); newImagePathRef.current = null; stagedPath = null;
          setForm((current) => current.imagePath === path ? { ...current, imageUrl: null, imagePath: null } : current);
          setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}${cleaned ? '' : ' (pembersihan gambar gagal)'}`);
        } else setMessage(`${copy.failed}${data.code ? ` (${String(data.code)})` : ''}`);
        return;
      }
      const saved = data.method as AdminPaymentMethod;
      setMethods((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
      newImagePathRef.current = null; uncertainCommitRef.current = false;
      setMessage(copy.saved); setForm(blank()); setEditingId(null); clearCandidate();
    } catch (error) {
      if (stagedPath) {
        // A network failure after the metadata PUT may mean the DB committed. Keep the
        // object instead of risking a saved row pointing to an image we just deleted.
        uncertainCommitRef.current = true;
        setMessage(`${copy.failed} (${error instanceof Error ? error.message : 'network_error'}). Status penyimpanan belum pasti; gambar dipertahankan agar metode aktif tidak rusak.`);
      } else if (error instanceof Error && error.message === 'qris_image_not_confirmed') {
        setMessage('QRIS aktif harus memiliki hasil crop yang tervalidasi dan dikonfirmasi sebelum disimpan.');
      } else {
        setMessage(`${copy.failed} (${error instanceof Error ? error.message : 'network_error'})`);
      }
    } finally {
      setUploading(false); savingRef.current = false; setBusy(false);
    }
  }

  const type = form.paymentType ?? 'other';
  const paymentTypeLabel: Record<string, string> = { bank_transfer: 'Transfer bank', e_wallet: 'Dompet elektronik', qris: 'QRIS', other: 'Lainnya' };
  const verifiedCurrentQris = form.qrisDetectionStatus === 'confirmed' && isVerifiedQrisImagePath(form.imagePath);
  const activeQrisImage = methods.find((method) => method.paymentType === 'qris' && method.active && method.qrisDetectionStatus === 'confirmed' && isVerifiedQrisImagePath(method.imagePath))?.imageUrl ?? null;
  const displayQrisImage = candidate?.previewDataUrl ?? activeQrisImage;

  return <div className="mt-8 space-y-6">
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <section aria-label={copy.add} className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">{editingId ? copy.edit : copy.add}</p><h2 className="mt-2 font-display text-3xl">{editingId ? copy.edit : copy.add}</h2></div><span className="grid size-10 place-items-center rounded-2xl bg-sage/20 text-moss"><ImagePlus size={19} /></span></div>
        <p className="mt-3 text-sm leading-6 text-ink/60">{copy.note}</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]"><p className="rounded-xl bg-ivory px-4 py-3 text-xs leading-5 text-ink/55">{editingId ? `ID internal: ${editingId}` : 'ID metode dibuat otomatis saat disimpan'}</p><label className="block text-sm font-semibold">{copy.name}<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm focus:border-moss focus:outline-none" /></label></div>
          <label className="block text-sm font-semibold">{copy.paymentType}<select value={type} onChange={(event) => { const paymentType = event.target.value as Form['paymentType']; setForm({ ...form, paymentType }); if (paymentType !== 'qris') clearCandidate(); }} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm"><option value="bank_transfer">{copy.bankTransfer}</option><option value="e_wallet">{copy.eWallet}</option><option value="qris">{copy.qris}</option><option value="other">{copy.other}</option></select></label>
          {(type === 'bank_transfer' || type === 'e_wallet') && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">{copy.providerName}<input required maxLength={120} value={form.providerName ?? ''} onChange={(event) => setForm({ ...form, providerName: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label><label className="block text-sm font-semibold">{copy.accountNumber}<input required maxLength={120} value={form.accountNumber ?? ''} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label>{type === 'bank_transfer' && <label className="block text-sm font-semibold sm:col-span-2">{copy.accountHolder}<input required maxLength={120} value={form.accountHolder ?? ''} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" /></label>}</div>}
          <label className="block text-sm font-semibold">{copy.instructions}<textarea maxLength={2000} rows={4} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} className="mt-2 w-full resize-y rounded-xl border border-line bg-ivory px-4 py-3 text-sm leading-6 focus:border-moss focus:outline-none" /></label>
          <div className="grid gap-5 sm:grid-cols-2"><p className="rounded-xl bg-ivory px-4 py-3 text-xs leading-5 text-ink/55">{copy.order}: {editingId ? `#${form.sortOrder ?? 0}` : 'otomatis'}</p><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="size-4 accent-[#66745d]" />{copy.active}</label></div>

          <div className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Gambar pembayaran <span className="font-normal text-ink/45">(JPG, PNG, WEBP · maks. 5 MB)</span></p><button type="button" disabled={uploading || busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-semibold disabled:opacity-50"><ImagePlus size={14} />{type === 'qris' ? 'Unggah atau ganti QRIS' : 'Unggah atau ganti gambar'}</button></div>
            <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            {type === 'qris' && <p className="mt-3 text-xs leading-5 text-ink/55">Sumber hanya diproses lokal di server. QRIS harus memiliki payload EMVCo Indonesia dan CRC valid; hasil disimpan sebagai PNG lossless dengan quiet zone minimal 4 modul.</p>}
            {candidate && type === 'qris' ? <div className="mt-4 flex flex-wrap items-start gap-4"><div className="rounded-2xl border border-line bg-white p-3"><img src={candidate.previewDataUrl} alt="Pratinjau hasil ekstraksi QRIS" className="size-44 object-contain" /></div><div className="min-w-48 flex-1"><p className="font-semibold text-moss">Hasil ekstraksi siap diperiksa</p><p className="mt-1 text-xs leading-5 text-ink/60">Hanya QRIS dan quiet zone; payload tetap sama dan hasil crop sudah didekode ulang.</p><button type="button" onClick={() => void removeImage()} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold"><Trash2 size={14} />Batalkan hasil / hapus gambar aktif</button></div></div>
              : form.imageUrl ? <div className="mt-4 flex flex-wrap items-start gap-4"><div className="relative rounded-2xl border border-line bg-ivory p-2"><img src={form.imageUrl} alt="Gambar metode pembayaran tersimpan" className="size-36 object-contain" /><button type="button" onClick={() => void removeImage()} className="absolute right-2 top-2 rounded-full bg-paper p-2 text-ink/60 shadow" aria-label="Hapus gambar pembayaran"><Trash2 size={15} /></button></div>{type === 'qris' && !verifiedCurrentQris && <p className="max-w-xs text-xs leading-5 text-rose">QRIS lama belum tervalidasi dan tidak ditampilkan pada pelanggan. Unggah ulang QRIS agar metode dapat diaktifkan.</p>}</div>
                : <p className="mt-3 text-xs text-ink/50">Belum ada gambar yang dipilih.</p>}
            {qrisMessage && type === 'qris' && <p role="status" className="mt-3 rounded-xl bg-ivory px-3 py-2 text-xs leading-5">{qrisMessage}</p>}
            {sourceUrl && type === 'qris' && <div className="mt-4 rounded-2xl bg-ivory p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">Area QR manual</p><p className="mt-1 max-w-lg text-xs leading-5 text-ink/55">Jika deteksi otomatis keliru atau gambar memuat beberapa QR, tandai satu kode beserta seluruh zona kosong minimal 4 modul di sekelilingnya.</p></div><button type="button" onClick={() => { setManualMode((current) => !current); setSelection(null); }} className="rounded-full border border-line bg-paper px-3 py-2 text-xs font-semibold">{manualMode ? 'Tutup pilihan manual' : 'Pilih area secara manual'}</button></div>
              {manualMode && <div className="mt-4"><div className="relative inline-block max-w-full touch-none select-none" onPointerDown={(event) => { const point = selectionPoint(event); if (!point) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragStartRef.current = point; setSelection({ x: point.x, y: point.y, width: 0, height: 0 }); }} onPointerMove={(event) => { if (!dragStartRef.current) return; const point = selectionPoint(event); if (!point) return; const start = dragStartRef.current; setSelection({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) }); }} onPointerUp={() => { dragStartRef.current = null; }} onPointerCancel={() => { dragStartRef.current = null; }}>
                  <img ref={sourceImageRef} src={sourceUrl} alt="Sumber gambar untuk memilih area QR" className="block max-h-[420px] max-w-full object-contain" />
                  {selection && <div aria-hidden className="pointer-events-none absolute border-2 border-moss bg-moss/10" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }} />}
                </div><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={uploading || !sourceFile || !selection || selection.width < 0.08 || selection.height < 0.08} onClick={() => { if (sourceFile) void previewQris(sourceFile, selection, ++previewRequestRef.current); }} className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-ivory disabled:opacity-45">{uploading ? 'Memvalidasi…' : 'Validasi area pilihan'}</button><span className="text-xs text-ink/50">Seret untuk menggambar kotak; hasil tetap disimpan hanya setelah konfirmasi.</span></div></div>}
            </div>}
          </div>

          {message && <p role="status" className="rounded-xl bg-ivory px-4 py-3 text-sm">{message}</p>}
          <div className="flex flex-wrap gap-3"><button disabled={busy || uploading || (type === 'qris' && form.active && !candidate && !verifiedCurrentQris)} className="rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? 'Menyimpan…' : copy.save}</button>{editingId && <button type="button" onClick={reset} className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">{copy.cancel}</button>}</div>
        </form>
      </section>

      <section aria-label={copy.name}><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-moss">Metode yang dikonfigurasi</p><h2 className="mt-2 font-display text-3xl">{copy.name}</h2></div><span className="rounded-full bg-sage/20 px-3 py-1 text-xs font-bold text-moss">{methods.length} metode</span></div>{methods.length === 0 ? <p className="mt-5 rounded-2xl border border-line bg-paper p-6 text-sm text-ink/55">{copy.empty}</p> : <ul className="mt-5 space-y-3">{methods.map((method) => <li key={method.id} className="rounded-3xl border border-line bg-paper p-5 shadow-sm"><div className="flex items-start gap-4">{method.imageUrl ? <img src={method.imageUrl} alt="" className="size-16 shrink-0 rounded-2xl border border-line bg-ivory object-contain p-1" /> : <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ivory text-ink/30"><CreditCard size={22} /></div>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{method.name}</p><p className="mt-1 font-mono text-xs text-ink/45">{method.id} · {paymentTypeLabel[method.paymentType ?? 'other'] ?? 'Lainnya'} · #{method.sortOrder}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${method.active ? 'bg-sage/30 text-moss' : 'bg-ivory text-ink/50'}`}>{method.active ? copy.enabled : copy.disabled}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink/65">{method.providerName ? `${method.providerName}${method.accountNumber ? ` · ${method.accountNumber}` : ''}` : method.instructions || '—'}</p>{method.paymentType === 'qris' && method.qrisDetectionStatus !== 'confirmed' && <p className="mt-2 text-xs font-semibold text-rose">QRIS belum tervalidasi · tidak ditampilkan ke pelanggan</p>}<button type="button" onClick={() => beginEdit(method)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-xs font-semibold"><Pencil size={14} />{copy.edit}</button></div></div></li>)}</ul>}</section>
    </div>

    <QrisDisplayManager initial={initialQrisDisplay} qrisImageUrl={displayQrisImage} />
  </div>;
}
