'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Proof = { available: true; contentType: string; sizeBytes: number; submittedAtMs: number } | null;
type AiReview = {
  state: string; recipient: string | null; accountNumber: string | null; amountIdr: number | null;
  paymentDate: string | null; transactionId: string | null; confidence: number | null;
  amountCheck: string; recipientCheck: string; accountNumberCheck: string;
  autoApproval: string; notes: string[]; analyzedAtMs: number | null;
} | null;
type Order = {
  orderId: string; customerEmail: string | null; customerWhatsapp: string | null; packageId: string;
  packageSnapshot: { name?: string; durationDays?: number } | null; originalAmountIdr: number; discountIdr: number;
  amountIdr: number; voucherCode: string | null; paymentMethodId: string;
  paymentMethodSnapshot: { name?: string; instructions?: string } | null; status: string; proof: Proof; proofAiVerification: AiReview;
  rejectionReason: string | null; reviewedBy: string | null; reviewedAtMs: number | null; subscriptionId: string | null;
  createdAtMs: number; updatedAtMs: number; giftId: string | null; templateId: string | null;
  publicSlug: string | null; publicationStatus: string; canReview: boolean; deletedAtMs?: number | null;
};
type Audit = { id: string; action: string; actorUid: string; atMs: number; reason: string | null };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const statusLabel: Record<string, string> = { awaiting_payment: 'Menunggu pembayaran', proof_submitted: 'Menunggu verifikasi', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' };
const checkLabel: Record<string, string> = { match: 'SESUAI', mismatch: 'TIDAK SESUAI', unknown: 'PERLU DIPERIKSA' };
const checkClass: Record<string, string> = { match: 'bg-[#e4efe3] text-moss', mismatch: 'bg-[#f2dfd8] text-rose', unknown: 'bg-ivory text-ink/60' };
const proofAiStateLabel: Record<string, string> = { analyzed: 'SUDAH DIANALISIS', unavailable_manual_review: 'PERLU TINJAUAN MANUAL', manual_review: 'PERLU TINJAUAN MANUAL', failed: 'GAGAL' };
const auditActionLabel: Record<string, string> = { 'qris_display.update': 'Pembaruan tampilan QRIS', 'voucher.delete': 'Penghapusan voucher', 'order.delete': 'Penghapusan pesanan', 'order.approve': 'Persetujuan pesanan', 'order.payment_reference_duplicate': 'Referensi pembayaran duplikat terdeteksi', 'order.auto_approve_gemini': 'Persetujuan otomatis oleh Gemini', 'order.reject': 'Penolakan pesanan', 'order.proof_submitted': 'Bukti pembayaran dikirim' };

export function AdminOrderReview({ order, audit }: { order: Order; audit: Audit[] }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofPreviewMessage, setProofPreviewMessage] = useState('');

  useEffect(() => {
    if (!order.proof) return;
    void fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}/proof`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || typeof data.url !== 'string') throw new Error(String(data.code ?? 'pratinjau_tidak_tersedia'));
        setProofPreviewUrl(data.url);
      })
      .catch(() => setProofPreviewMessage('Pratinjau penyimpanan privat belum tersedia di lingkungan ini.'));
  }, [order.orderId, order.proof]);

  async function submit(decision: 'approve' | 'reject') {
    if (decision === 'approve' && !window.confirm('Setujui pembayaran ini dan aktifkan paket?')) return;
    if (decision === 'reject' && !reason.trim()) { setMessage('Isi alasan penolakan terlebih dahulu.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(decision === 'approve' ? { decision } : { decision, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setMessage(`Tindakan gagal: ${String(data.code ?? 'unknown_error')}`); return; }
      setMessage(decision === 'approve' ? 'Pesanan disetujui; langganan aktif.' : 'Pesanan ditolak.');
      window.location.reload();
    } catch { setMessage('Server tidak dapat dijangkau. Coba lagi.'); }
    finally { setBusy(false); }
  }

  async function deleteOrder() {
    if (deleteBusy || order.deletedAtMs) return;
    const confirmed = window.confirm(`Hapus transaksi ${order.orderId} dari daftar aktif?\n\nTindakan ini hanya menyembunyikan transaksi (soft delete). Pembayaran, riwayat laporan, hadiah, dan langganan tidak dibatalkan atau dihapus.`);
    if (!confirmed) return;
    setDeleteBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setMessage(`Penghapusan gagal: ${String(data.code ?? 'unknown_error')}`); return; }
      window.location.assign('/admin/orders?deleted=1');
    } catch { setMessage('Server tidak dapat dijangkau. Transaksi tidak dihapus; coba lagi.'); }
    finally { setDeleteBusy(false); }
  }

  return <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.8fr]">
    <section className="space-y-5 rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Transaksi / detail</p><h1 className="mt-2 break-all font-mono text-2xl">{order.orderId}</h1></div><span className="rounded-full bg-ivory px-4 py-2 text-sm font-semibold">{statusLabel[order.status] ?? order.status}</span></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-line p-4"><p className="text-xs text-ink/50">Kontak pelanggan</p><p className="mt-2 break-all text-sm font-medium">{order.customerEmail ?? '—'}</p><p className="mt-1 text-sm text-ink/60">{order.customerWhatsapp ?? '—'}</p></div><div className="rounded-2xl border border-line p-4"><p className="text-xs text-ink/50">Paket / durasi</p><p className="mt-2 font-semibold">{order.packageSnapshot?.name ?? order.packageId}</p><p className="mt-1 text-sm text-ink/60">{order.packageSnapshot?.durationDays ?? '—'} hari</p></div></div>
      <div className="rounded-2xl border border-line p-5"><p className="text-sm text-ink/55">Harga awal <span className="float-right font-medium text-ink">{money(order.originalAmountIdr)}</span></p>{order.voucherCode && <p className="mt-2 text-sm text-ink/55">Voucher {order.voucherCode}</p>}<p className="mt-2 text-sm text-ink/55">Diskon <span className="float-right font-medium text-ink">−{money(order.discountIdr)}</span></p><p className="mt-3 border-t border-line pt-3 text-sm font-semibold">Total <span className="float-right">{money(order.amountIdr)}</span></p></div>
      <div className="rounded-2xl bg-ivory p-5"><h2 className="font-semibold">Metode pembayaran</h2><p className="mt-2 text-sm font-medium">{order.paymentMethodSnapshot?.name ?? order.paymentMethodId}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/65">{order.paymentMethodSnapshot?.instructions ?? 'Salinan instruksi tidak tersedia pada pesanan lama.'}</p></div>
      <div className="rounded-2xl border border-line p-5"><h2 className="font-semibold">Bukti pembayaran</h2>{order.proof ? <div className="mt-3 text-sm text-ink/65"><p>{order.proof.contentType} · {Math.round(order.proof.sizeBytes / 1024)} KB</p><p className="mt-1">Dikirim {new Date(order.proof.submittedAtMs).toLocaleString('id-ID')}</p>{proofPreviewUrl ? <a className="mt-3 inline-flex rounded-full bg-moss px-4 py-2 text-xs font-semibold text-ivory" href={proofPreviewUrl} target="_blank" rel="noreferrer">Buka pratinjau privat</a> : <p className="mt-3 rounded-xl bg-ivory p-3 text-xs leading-5">{proofPreviewMessage || 'Menyiapkan pratinjau penyimpanan privat…'}</p>}</div> : <p className="mt-2 text-sm text-ink/55">Belum ada bukti yang tercatat. Pengunggahan atau pengiriman bukti belum tersedia sampai Supabase Storage dikonfigurasi.</p>}</div>
      {order.proofAiVerification && <div className="rounded-2xl border border-sage bg-[#f7f8f2] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-semibold">Bantuan verifikasi Gemini</h2><span className="rounded-full bg-ivory px-3 py-1 text-xs font-semibold">{order.proofAiVerification.autoApproval === 'approved' ? 'DISETUJUI OTOMATIS' : order.proofAiVerification.autoApproval === 'manual_review' ? 'TINJAUAN MANUAL' : order.proofAiVerification.autoApproval === 'not_evaluated' ? 'BELUM DIEVALUASI' : proofAiStateLabel[order.proofAiVerification.state] ?? 'STATUS TINJAUAN'}</span></div><p className="mt-2 text-xs leading-5 text-ink/55">Ekstraksi AI hanya sebagai bantuan, bukan konfirmasi bank. Tetap periksa bukti dan ambil keputusan admin bila perlu.</p>{order.proofAiVerification.state === 'analyzed' ? <><div className="mt-4 grid gap-2 sm:grid-cols-2">{([['Jumlah', order.proofAiVerification.amountCheck, order.proofAiVerification.amountIdr === null ? 'Tidak terbaca' : money(order.proofAiVerification.amountIdr)], ['Penerima', order.proofAiVerification.recipientCheck, order.proofAiVerification.recipient ?? 'Tidak terbaca'], ['Nomor rekening', order.proofAiVerification.accountNumberCheck, order.proofAiVerification.accountNumber ?? 'Tidak terbaca']] as const).map(([label, check, value]) => <div key={label} className="rounded-xl bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-ink/55">{label}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${checkClass[check] ?? checkClass.unknown}`}>{checkLabel[check] ?? checkLabel.unknown}</span></div><p className="mt-2 break-all text-sm font-medium">{value}</p></div>)}</div><div className="mt-3 grid gap-2 text-sm text-ink/65 sm:grid-cols-2"><p>Tanggal: {order.proofAiVerification.paymentDate ?? 'Tidak terbaca'}</p><p>ID referensi: <span className="break-all">{order.proofAiVerification.transactionId ?? 'Tidak terbaca'}</span></p><p>Tingkat keyakinan Gemini: {order.proofAiVerification.confidence === null ? '—' : `${Math.round(order.proofAiVerification.confidence * 100)}%`}</p><p>Waktu analisis: {order.proofAiVerification.analyzedAtMs ? new Date(order.proofAiVerification.analyzedAtMs).toLocaleString('id-ID') : '—'}</p></div>{order.proofAiVerification.notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink/55">{order.proofAiVerification.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}</> : <p className="mt-3 text-sm text-ink/60">Analisis AI belum tersedia ({proofAiStateLabel[order.proofAiVerification.state] ?? 'status tidak diketahui'}).</p>}</div>}
      {order.rejectionReason && <p className="rounded-xl bg-[#f2dfd8] p-4 text-sm">Alasan penolakan: {order.rejectionReason}</p>}
      <div className="grid gap-2 text-xs text-ink/50 sm:grid-cols-2"><p>Dibuat: {new Date(order.createdAtMs).toLocaleString('id-ID')}</p><p>Diperbarui: {new Date(order.updatedAtMs).toLocaleString('id-ID')}</p></div>
      <div className="flex flex-wrap gap-4 text-sm">{order.publicSlug && <Link className="text-moss underline" href={`/g/${order.publicSlug}`}>Buka hadiah yang telah diterbitkan</Link>}{order.giftId && <span className="font-mono text-xs text-ink/45">Hadiah {order.giftId}</span>}</div>
    </section>
    <aside className="space-y-6">
      <section className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl">Verifikasi admin</h2><p className="mt-2 text-sm leading-6 text-ink/60">Persetujuan mengaktifkan langganan. Jangan menyetujui sebelum bukti privat dapat diperiksa.</p>
        {!order.canReview && <p className="mt-4 rounded-xl bg-ivory p-4 text-sm leading-6 text-ink/60">Tindakan menyetujui atau menolak terkunci sampai status bukti terkirim memiliki metadata bukti yang valid. Berkas pratinjau penyimpanan belum tersedia.</p>}
        <label className="mt-5 block text-sm font-semibold">Alasan penolakan<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={3} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm" placeholder="Jelaskan alasan yang dapat ditindaklanjuti" /></label>
        {message && <p role="status" className="mt-4 rounded-xl bg-ivory p-3 text-sm">{message}</p>}
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!order.canReview || busy} onClick={() => void submit('approve')} className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-45">Setujui dan aktifkan</button><button type="button" disabled={!order.canReview || busy || !reason.trim()} onClick={() => void submit('reject')} className="rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-45">Tolak</button></div>
        {order.subscriptionId && <p className="mt-4 break-all text-xs text-ink/50">Langganan: {order.subscriptionId}</p>}
      </section>
      <section className="rounded-3xl border border-[#d9aaa0] bg-paper p-6"><h2 className="font-display text-2xl">Hapus transaksi</h2><p className="mt-2 text-sm leading-6 text-ink/60">Penghapusan lunak (soft delete) hanya menyembunyikan transaksi dari daftar aktif. Status pembayaran, audit/laporan, hadiah, dan langganan tetap tersimpan; tindakan ini bukan pembatalan atau penghapusan hadiah.</p>{order.deletedAtMs ? <p className="mt-4 rounded-xl bg-ivory p-3 text-sm">Transaksi dihapus dari daftar aktif pada {new Date(order.deletedAtMs).toLocaleString('id-ID')}.</p> : <button type="button" disabled={deleteBusy} onClick={() => void deleteOrder()} className="mt-4 rounded-full border border-rose/50 px-5 py-3 text-sm font-semibold text-rose disabled:opacity-45">{deleteBusy ? 'Menghapus…' : 'Hapus transaksi'}</button>}</section>
      <section className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl">Riwayat admin</h2>{audit.length === 0 ? <p className="mt-3 text-sm text-ink/55">Belum ada tindakan admin pada pesanan ini.</p> : <ol className="mt-4 space-y-4">{audit.map((item) => <li key={item.id} className="border-l-2 border-sage pl-4"><p className="text-sm font-semibold">{auditActionLabel[item.action] ?? item.action}</p><p className="mt-1 text-xs text-ink/50">{item.actorUid} · {new Date(item.atMs).toLocaleString('id-ID')}</p>{item.reason && <p className="mt-1 text-sm text-ink/65">{item.reason}</p>}</li>)}</ol>}</section>
    </aside>
  </div>;
}
