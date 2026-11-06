'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GiftSuccessActions } from '@/components/gift-success-actions';
import { SITE_ORIGIN } from '@/lib/site-url';

type OrderView = {
  orderId: string; giftId: string | null; giftSlug: string | null; packageId: string; packageName: string; originalAmountIdr: number; discountIdr: number;
  amountIdr: number; voucherCode: string | null;
  paymentMethod: { name: string; instructions: string; paymentType?: string; providerName?: string | null; accountNumber?: string | null; accountHolder?: string | null; imageUrl?: string | null; qrisDisplay?: { title: string; description: string; backgroundColor: string; accentColor: string; borderColor: string; footer: string; logoUrl: string | null; frameStyle: 'card' | 'minimal'; decoration: 'none' | 'petals' | 'ribbon' } };
  deletedAtMs?: number | null;
  status: string; createdAtMs: number; updatedAtMs: number;
};
type Copy = {
  eyebrow: string; title: string; loading: string; unavailable: string; missingToken: string; refresh: string;
  transactionNumber: string; package: string; original: string; discount: string; amount: string; voucher: string;
  paymentMethod: string; instructions: string; qrisScan: string; providerName: string; accountNumber: string; accountHolder: string; status: string; created: string; updated: string;
  awaiting_payment: string; proof_submitted: string; approved: string; rejected: string; cancelled: string;
  manualNote: string; continueEditing: string; notPublishedYet: string; publishedSuccess: string; publicLink: string;
  copyPublicLink: string; copied: string; openGift: string; shareGift: string; giftQr: string; close: string;
  editLinkLabel: string; editLinkWarning: string; copyEditLink: string; editLinkCopied: string;
  qrDescription: string; qrForeground: string; qrBackground: string; qrDownloadPng: string; qrDownloadSvg: string; qrisDownload: string; storageNotice: string;
  proofTitle: string; proofChoose: string; proofSubmit: string; proofUploading: string; proofUploadFailed: string; proofUploadSuccess: string;
  deleteTitle: string; deleteOrder: string; deleteOrderConfirm: string; deleteOrderEffect: string; deleteOrderBusy: string; deleteOrderFailed: string; deleteOrderSuccess: string;
};

const currency = (value: number, locale: 'id' | 'en') => new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export function GuestOrderDetail({ orderId, locale, copy }: { orderId: string; locale: 'id' | 'en'; copy: Copy }) {
  const [accessToken, setAccessToken] = useState<string | null | undefined>(undefined);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofMessage, setProofMessage] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [orderDeleted, setOrderDeleted] = useState(false);

  useEffect(() => {
    try { setAccessToken(window.sessionStorage.getItem(`bloomora_order_access:${orderId}`)); setOrigin(SITE_ORIGIN); }
    catch { setAccessToken(null); }
  }, [orderId]);

  useEffect(() => {
    if (!order?.giftId || !origin) { setEditUrl(''); return; }
    try {
      const token = window.sessionStorage.getItem(`bloomora_edit_token:${order.giftId}`) ?? window.sessionStorage.getItem('bloomora_edit_token');
      setEditUrl(token ? `${origin}/edit/${token}` : '');
    } catch { setEditUrl(''); }
  }, [order?.giftId, origin]);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/guest/orders/${encodeURIComponent(orderId)}`, {
        cache: 'no-store', headers: { 'x-bloomora-order-token': accessToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.order) throw new Error('order_unavailable');
      setOrder(data.order as OrderView); setError('');
    } catch { setError(copy.unavailable); }
    finally { setRefreshing(false); }
  }, [accessToken, copy.unavailable, orderId]);

  // Hemat kuota Vercel: polling hanya saat tab terlihat, tiap 60 detik, dan berhenti
  // untuk order yang sudah final (rejected/cancelled). Tombol refresh manual tetap ada.
  const statusRef = useRef<string | undefined>(undefined);
  useEffect(() => { statusRef.current = order?.status; }, [order?.status]);
  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (statusRef.current === 'rejected' || statusRef.current === 'cancelled') return;
      void refresh();
    };
    const timer = window.setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [accessToken, refresh]);

  const date = (value: number) => new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  async function uploadProof() {
    if (!proofFile || !accessToken) return;
    setProofBusy(true); setProofMessage('');
    try {
      const body = new FormData(); body.set('proof', proofFile);
      const response = await fetch(`/api/guest/orders/${encodeURIComponent(orderId)}/proof`, { method: 'POST', headers: { 'x-bloomora-order-token': accessToken }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(String(data.code ?? 'proof_upload_failed'));
      setProofFile(null); setProofMessage(copy.proofUploadSuccess); await refresh();
    } catch { setProofMessage(copy.proofUploadFailed); }
    finally { setProofBusy(false); }
  }
  async function deleteOwnOrder() {
    if (!order || !accessToken || deleteBusy) return;
    if (!window.confirm(`${copy.deleteOrderConfirm}\n\n${order.orderId}\n\n${copy.deleteOrderEffect}`)) return;
    setDeleteBusy(true); setDeleteMessage('');
    try {
      const response = await fetch(`/api/guest/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE', headers: { 'x-bloomora-order-token': accessToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setDeleteMessage(copy.deleteOrderFailed); return; }
      setOrderDeleted(true); setOrder(null);
    } catch { setDeleteMessage(copy.deleteOrderFailed); }
    finally { setDeleteBusy(false); }
  }
  if (accessToken === undefined) return <div className="rounded-3xl border border-line bg-paper p-8 text-sm text-ink/60">{copy.loading}</div>;
  if (!accessToken) return <div role="alert" className="rounded-3xl border border-line bg-paper p-8 text-sm leading-7 text-ink/65">{copy.missingToken}</div>;
  if (orderDeleted) return <section className="rounded-3xl border border-line bg-paper p-6 shadow-soft sm:p-8" role="status"><h1 className="font-display text-3xl">{copy.deleteOrderSuccess}</h1><p className="mt-3 text-sm leading-6 text-ink/65">{copy.deleteOrderEffect}</p></section>;

  const statusLabels: Record<string, string> = {
    awaiting_payment: copy.awaiting_payment, proof_submitted: copy.proof_submitted,
    approved: copy.approved, rejected: copy.rejected, cancelled: copy.cancelled,
  };
  return <section className="rounded-3xl border border-line bg-paper p-6 shadow-soft sm:p-8">
    {!order && !error ? <p className="text-sm text-ink/60">{copy.loading}</p> : error ? <p role="alert" className="text-sm text-ink/65">{error}</p> : null}
    {order && <>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{copy.eyebrow}</p><h1 className="mt-2 font-display text-4xl">{copy.title}</h1></div><span className="rounded-full bg-sage/30 px-4 py-2 text-sm font-semibold text-moss">{statusLabels[order.status] ?? order.status}</span></div>
      <div className="mt-6 rounded-2xl bg-ivory p-5"><p className="text-xs uppercase tracking-[.15em] text-ink/45">{copy.transactionNumber}</p><p className="mt-2 break-all font-mono text-sm font-semibold">{order.orderId}</p></div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-line p-4"><dt className="text-xs text-ink/50">{copy.package}</dt><dd className="mt-1 font-semibold">{order.packageName}</dd></div><div className="rounded-2xl border border-line p-4"><dt className="text-xs text-ink/50">{copy.paymentMethod}</dt><dd className="mt-1 font-semibold">{order.paymentMethod.name}</dd></div></dl>
      {(order.paymentMethod.providerName || order.paymentMethod.accountNumber || order.paymentMethod.accountHolder || (order.paymentMethod.paymentType === 'qris' && order.paymentMethod.imageUrl)) && <div className="mt-4 grid gap-4 rounded-2xl border border-line p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <dl className="space-y-3 text-sm">{order.paymentMethod.providerName && <div><dt className="text-xs text-ink/50">{copy.providerName}</dt><dd className="mt-1 font-semibold">{order.paymentMethod.providerName}</dd></div>}{order.paymentMethod.accountNumber && <div><dt className="text-xs text-ink/50">{copy.accountNumber}</dt><dd className="mt-1 break-all font-mono font-semibold">{order.paymentMethod.accountNumber}</dd></div>}{order.paymentMethod.accountHolder && <div><dt className="text-xs text-ink/50">{copy.accountHolder}</dt><dd className="mt-1 font-semibold">{order.paymentMethod.accountHolder}</dd></div>}</dl>
        {order.paymentMethod.paymentType === 'qris' && order.paymentMethod.imageUrl && <div className="sm:row-span-2"><div className="relative overflow-hidden p-4 text-center" style={{ backgroundColor: order.paymentMethod.qrisDisplay?.backgroundColor ?? '#fffaf3', border: `2px solid ${order.paymentMethod.qrisDisplay?.borderColor ?? '#d9d1c5'}`, borderRadius: order.paymentMethod.qrisDisplay?.frameStyle === 'minimal' ? 12 : 24, color: order.paymentMethod.qrisDisplay?.accentColor ?? '#66745d' }}>{order.paymentMethod.qrisDisplay?.decoration !== 'none' && <span aria-hidden className="pointer-events-none absolute right-2 top-1 text-xl opacity-35">{order.paymentMethod.qrisDisplay?.decoration === 'petals' ? '✦' : '⌁'}</span>}<p className="font-display text-xl">{order.paymentMethod.qrisDisplay?.title ?? 'Scan untuk membayar'}</p><p className="mt-1 text-xs leading-5 opacity-75">{order.paymentMethod.qrisDisplay?.description}</p><img src={order.paymentMethod.imageUrl} alt={`${order.paymentMethod.name} QRIS`} className="mx-auto mt-3 max-h-72 w-64 rounded-xl bg-white object-contain p-2" /><p className="mt-2 text-xs opacity-75">{order.paymentMethod.qrisDisplay?.footer}</p></div><p className="mt-2 max-w-64 text-center text-xs leading-5 text-ink/60">{copy.qrisScan}</p><a href={order.paymentMethod.imageUrl} download className="mt-3 inline-flex w-full justify-center rounded-full border border-line px-4 py-2 text-xs font-semibold hover:bg-ivory">{copy.qrisDownload}</a></div>}
      </div>}
      <div className="mt-4 rounded-2xl border border-line p-5"><p className="text-sm text-ink/55">{copy.original}: <span className="font-medium text-ink">{currency(order.originalAmountIdr, locale)}</span></p>{order.voucherCode && <p className="mt-2 text-sm text-ink/55">{copy.voucher}: <span className="font-mono font-medium text-ink">{order.voucherCode}</span></p>}<p className="mt-2 text-sm text-ink/55">{copy.discount}: <span className="font-medium text-ink">−{currency(order.discountIdr, locale)}</span></p><p className="mt-3 border-t border-line pt-3 text-sm font-semibold">{copy.amount}<span className="float-right">{currency(order.amountIdr, locale)}</span></p></div>
      <div className="mt-5 rounded-2xl bg-ivory p-5"><h2 className="font-semibold">{copy.instructions}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/70">{order.paymentMethod.instructions}</p></div>
      {(order.status === 'awaiting_payment' || order.status === 'rejected') && <div className="mt-5 rounded-2xl border border-line p-5"><h2 className="font-semibold">{copy.proofTitle}</h2><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" /><p className="mt-2 text-xs leading-5 text-ink/50">{copy.storageNotice}</p><button type="button" disabled={!proofFile || proofBusy} onClick={() => void uploadProof()} className="mt-4 rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-45">{proofBusy ? copy.proofUploading : copy.proofSubmit}</button>{proofMessage && <p role="status" className="mt-3 text-sm text-ink/65">{proofMessage}</p>}</div>}
      <div className="mt-5 grid gap-2 text-xs text-ink/50 sm:grid-cols-2"><p>{copy.created}: {date(order.createdAtMs)}</p><p>{copy.updated}: {date(order.updatedAtMs)}</p></div>
      {order.status === 'approved' && order.giftId && <Link href={editUrl || `/editor/g/${encodeURIComponent(order.giftId)}`} className="mt-5 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{copy.continueEditing}</Link>}
      {order.status === 'approved' && order.giftSlug && origin && <GiftSuccessActions publicUrl={`${origin}/g/${encodeURIComponent(order.giftSlug)}`} editUrl={editUrl || undefined} copy={copy} />}
      {order.status === 'approved' && !order.giftSlug && <p className="mt-5 rounded-2xl bg-sage/15 p-4 text-sm leading-6 text-ink/65">{copy.notPublishedYet}</p>}
      <p className="mt-5 rounded-2xl bg-sage/15 p-4 text-sm leading-6 text-ink/65">{copy.manualNote}</p>
      <div className="mt-5 rounded-2xl border border-line p-5"><h2 className="font-semibold">{copy.deleteTitle}</h2><p className="mt-2 text-sm leading-6 text-ink/60">{copy.deleteOrderEffect}</p>{deleteMessage && <p role="alert" className="mt-3 text-sm text-rose">{deleteMessage}</p>}<button type="button" disabled={deleteBusy || Boolean(order.deletedAtMs)} onClick={() => void deleteOwnOrder()} className="mt-4 rounded-full border border-rose/50 px-5 py-3 text-sm font-semibold text-rose disabled:opacity-45">{deleteBusy ? copy.deleteOrderBusy : copy.deleteOrder}</button></div>
    </>}
    <button type="button" disabled={!order || refreshing} onClick={() => void refresh()} className="mt-6 rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-50">{refreshing ? '…' : copy.refresh}</button>
  </section>;
}
