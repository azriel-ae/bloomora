'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PackageDoc, PackageId } from '@/lib/model/types';
import { SITE_ORIGIN } from '@/lib/site-url';

type Method = { id: string; name: string; instructions: string; active: boolean; sortOrder: number; imageUrl?: string | null };
type Copy = Record<string, string>;
type AppliedVoucher = { code: string; originalAmountIdr: number; discountIdr: number; amountIdr: number; discount?: { kind: 'percent' | 'fixed'; value?: number; valueIdr?: number } };
type DraftMediaSummary = { photos: number; audio: boolean };
function rupiah(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }

function checkoutIdempotencyKey(giftId: string): string {
  const storageKey = `bloomora_checkout_key:${giftId}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  window.sessionStorage.setItem(storageKey, key);
  return key;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function giftEditToken(giftId: string) {
  return window.sessionStorage.getItem(`bloomora_edit_token:${giftId}`) ?? window.sessionStorage.getItem('bloomora_edit_token');
}

function voucherMessage(code: string, copy: Copy): string {
  const messages: Record<string, string | undefined> = { voucher_invalid: copy.voucherInvalid, voucher_expired: copy.voucherExpired, voucher_not_started: copy.voucherNotStarted, voucher_usage_limit: copy.voucherUsageLimit, voucher_minimum_not_met: copy.voucherMinimumNotMet, voucher_inactive: copy.voucherInactive };
  return messages[code] ?? copy.voucherInvalid;
}

type SlugStatus = 'loading' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'locked';

export function GuestCheckout({ giftId, locale, copy, packages }: { giftId: string; locale: 'id' | 'en'; copy: Copy; packages: readonly PackageDoc[] }) {
  const [packageId, setPackageId] = useState<PackageId>(packages[0]?.id ?? 'basic');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [voucherStatus, setVoucherStatus] = useState('');
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('loading');
  const [origin, setOrigin] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [methods, setMethods] = useState<Method[]>([]);
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [methodsFailed, setMethodsFailed] = useState(false);
  const [draftMedia, setDraftMedia] = useState<DraftMediaSummary>({ photos: 0, audio: false });
  const [message, setMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [createdMethodName, setCreatedMethodName] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = packages.find((item) => item.id === packageId) ?? null;
  const selectedMethod = methods.find((method) => method.id === paymentMethodId) ?? null;
  const currentAmount = appliedVoucher?.amountIdr ?? selected?.priceIdr ?? 0;
  const packageBlockReason = (item: PackageDoc): string | null => {
    if (draftMedia.photos > item.limits.maxPhotos) return locale === 'id'
      ? `Paket ${item.name} mendukung maksimal ${item.limits.maxPhotos} foto. Hadiah kamu menggunakan ${draftMedia.photos} foto. Hapus minimal ${draftMedia.photos - item.limits.maxPhotos} foto untuk memilih paket ${item.name}.`
      : `${item.name} supports up to ${item.limits.maxPhotos} photos. Your gift uses ${draftMedia.photos}. Remove at least ${draftMedia.photos - item.limits.maxPhotos} photo(s) to choose ${item.name}.`;
    if (draftMedia.audio && !item.limits.music) return locale === 'id'
      ? `Paket ${item.name} tidak menyertakan musik. Hapus musik untuk memilih paket ${item.name}.`
      : `${item.name} does not include music. Remove the music to choose ${item.name}.`;
    return null;
  };
  useEffect(() => {
    const firstEligible = packages.find((item) => packageBlockReason(item) === null);
    if (firstEligible) setPackageId((current) => packageBlockReason(packages.find((item) => item.id === current) ?? firstEligible) === null ? current : firstEligible.id);
  }, [draftMedia, packages]);

  useEffect(() => {
    let active = true;
    fetch('/api/payment-methods', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !Array.isArray(data.methods)) throw new Error('methods_unavailable');
        if (!active) return;
        const loaded = (data.methods as Method[]).filter((method) => method.active === true);
        setMethods(loaded);
        setPaymentMethodId(loaded[0]?.id ?? '');
        setMethodsFailed(false);
      })
      .catch(() => { if (active) setMethodsFailed(true); })
      .finally(() => { if (active) setMethodsLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setOrigin(SITE_ORIGIN);
    const token = giftEditToken(giftId);
    if (!token) { setSlugStatus('invalid'); return () => { active = false; }; }
    fetch(`/api/guest/gifts/${encodeURIComponent(giftId)}`, { cache: 'no-store', headers: { 'x-bloomora-edit-token': token } })
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.ok && typeof data.slug === 'string') {
          setCustomSlug(data.slug);
          const media = data.draft?.content?.media;
          if (Array.isArray(media)) setDraftMedia({ photos: media.filter((item: { kind?: unknown }) => item?.kind === 'image').length, audio: media.some((item: { kind?: unknown }) => item?.kind === 'audio') });
        }
        else setSlugStatus(data.code === 'slug_locked' ? 'locked' : 'invalid');
      })
      .catch(() => { if (active) setSlugStatus('invalid'); });
    return () => { active = false; };
  }, [giftId]);

  useEffect(() => {
    if (!customSlug) { setSlugStatus('invalid'); return; }
    const token = giftEditToken(giftId);
    if (!token) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    let active = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/guest/gifts/${encodeURIComponent(giftId)}/slug?slug=${encodeURIComponent(customSlug)}`, {
        cache: 'no-store', headers: { 'x-bloomora-edit-token': token },
      }).then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
        .then(({ response, data }) => {
          if (!active) return;
          if (response.ok && data.available === true) setSlugStatus('available');
          else if (data.code === 'slug_locked') setSlugStatus('locked');
          else if (data.code === 'invalid_custom_slug') setSlugStatus('invalid');
          else setSlugStatus('unavailable');
        }).catch(() => { if (active) setSlugStatus('unavailable'); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [customSlug, giftId]);

  function changePackage(next: PackageId) {
    if (packageBlockReason(packages.find((item) => item.id === next) ?? packages[0]!) !== null) return;
    setPackageId(next);
    setAppliedVoucher(null);
    setVoucherStatus('');
  }

  async function applyVoucher(event?: React.FormEvent | React.KeyboardEvent) {
    event?.preventDefault();
    if (voucherBusy || !selected) return;
    const rawCode = voucherCode.trim().toUpperCase();
    if (!rawCode) { setAppliedVoucher(null); setVoucherStatus(copy.voucherEmpty); return; }
    setVoucherBusy(true); setVoucherStatus(copy.voucherChecking);
    try {
      const response = await fetch('/api/guest/vouchers/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ giftId, editToken: giftEditToken(giftId), packageId, voucherCode: rawCode }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || typeof data.voucherCode !== 'string') { setAppliedVoucher(null); setVoucherStatus(voucherMessage(String(data.code ?? 'voucher_invalid'), copy)); return; }
      setVoucherCode(data.voucherCode);
      setAppliedVoucher({ code: data.voucherCode, originalAmountIdr: Number(data.originalAmountIdr), discountIdr: Number(data.discountIdr), amountIdr: Number(data.amountIdr), discount: data.discount });
      setVoucherStatus(copy.voucherApplied);
    } catch { setAppliedVoucher(null); setVoucherStatus(copy.voucherValidationFailed); }
    finally { setVoucherBusy(false); }
  }

  function clearVoucher() { setVoucherCode(''); setAppliedVoucher(null); setVoucherStatus(''); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() && !whatsapp.trim()) { setContactError(copy.contactRequired); return; }
    setContactError('');
    setBusy(true); setMessage(''); setOrderId('');
    try {
      window.sessionStorage.setItem('bloomora_storage_test', '1');
      window.sessionStorage.removeItem('bloomora_storage_test');
    } catch {
      setMessage(copy.sessionStorageRequired); setBusy(false); return;
    }
    const editToken = giftEditToken(giftId);
    try {
      const idempotencyKey = checkoutIdempotencyKey(giftId);
      const response = await fetch('/api/guest/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ giftId, editToken, idempotencyKey, packageId, email, whatsapp, paymentMethodId, voucherCode: appliedVoucher?.code ?? '', customSlug }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        const code = String(data.code ?? '');
        if (code === 'contact_required') { setContactError(copy.contactRequired); return; }
        if (code === 'invalid_email') { setContactError(copy.invalidEmail); return; }
        if (code === 'invalid_whatsapp') { setContactError(copy.invalidWhatsapp); return; }
        if (code.startsWith('voucher_')) setVoucherStatus(voucherMessage(code, copy));
        setMessage(code.startsWith('voucher_') ? copy.invalidVoucher : code === 'order_create_failed' ? copy.orderServerError : code === 'edit_link_invalid' ? copy.invalidEditLink : code === 'slug_unavailable' ? copy.slugUnavailable : code === 'invalid_custom_slug' ? copy.slugInvalid : code === 'slug_locked' ? copy.slugLocked : code === 'slug_reservation_failed' ? copy.slugReservationFailed : copy.orderFailed);
        if (code === 'slug_unavailable') setSlugStatus('unavailable');
        return;
      }
      const createdOrderId = String(data.orderId ?? '');
      const orderAccessToken = String(data.orderAccessToken ?? '');
      if (!createdOrderId || orderAccessToken.length < 32) { setMessage(copy.orderFailed); return; }
      window.sessionStorage.setItem(`bloomora_order_access:${createdOrderId}`, orderAccessToken);
      window.sessionStorage.removeItem(`bloomora_checkout_key:${giftId}`);
      setOrderId(createdOrderId);
      setCreatedMethodName(selectedMethod?.name ?? '');
    } catch { setMessage(copy.networkError); }
    finally { setBusy(false); }
  }

  if (!giftId) return <div className="mx-auto max-w-2xl px-5 py-20"><div className="rounded-3xl border border-line bg-paper p-8 text-center"><h1 className="font-display text-3xl">{copy.giftRequired}</h1><p className="mt-3 text-sm text-ink/60">{copy.giftRequiredBody}</p></div></div>;
  if (orderId) return <div className="mx-auto max-w-2xl px-5 py-20"><div className="rounded-3xl border border-line bg-paper p-8 shadow-soft"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{copy.orderCreated}</p><h1 className="mt-3 font-display text-4xl">{createdMethodName}</h1><p className="mt-4 text-sm leading-7 text-ink/65">{copy.manualPayment}</p><div className="mt-6 rounded-2xl bg-ivory p-5"><p className="text-xs uppercase tracking-[.15em] text-ink/45">{copy.transactionNumber}</p><p className="mt-2 break-all font-mono text-sm font-semibold">{orderId}</p></div><Link href={`/payment/orders/${encodeURIComponent(orderId)}`} className="mt-6 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory">{copy.viewOrder}</Link><p className="mt-5 text-xs leading-5 text-ink/50">{copy.storageNotice}</p></div></div>;

  const slugStatusMessage = slugStatus === 'loading' || slugStatus === 'checking' ? copy.slugChecking
    : slugStatus === 'available' ? copy.slugAvailable
      : slugStatus === 'unavailable' ? copy.slugUnavailable
        : slugStatus === 'locked' ? copy.slugLocked : copy.slugInvalid;

  return <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20"><div className="mx-auto max-w-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{copy.eyebrow}</p><h1 className="mt-3 font-display text-5xl">{copy.title}</h1><p className="mt-4 text-sm leading-7 text-ink/60">{copy.contactIntro}</p><form onSubmit={submit} className="mt-10 space-y-6 rounded-3xl border border-line bg-paper p-6 shadow-soft sm:p-8">
    <fieldset className="rounded-2xl border border-line bg-ivory p-4"><legend className="px-1 text-sm font-semibold">{copy.customSlug}</legend><label className="block text-sm font-medium"><span className="sr-only">{copy.customSlug}</span><input required maxLength={48} autoComplete="off" value={customSlug} onChange={(event) => setCustomSlug(normalizeSlug(event.target.value))} className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 font-mono text-sm outline-none focus:border-moss" aria-describedby="custom-slug-help custom-slug-status" /></label><p id="custom-slug-help" className="mt-2 text-xs leading-5 text-ink/55">{copy.customSlugHelp}</p><p className="mt-2 break-all font-mono text-xs text-moss">{origin}/g/{customSlug || 'nama-link'}</p><p id="custom-slug-status" role="status" aria-live="polite" className="mt-2 text-xs text-ink/65">{slugStatusMessage}</p></fieldset>
    <fieldset><legend className="text-sm font-semibold">{copy.package}</legend>{packages.length === 0 ? <p className="mt-3 rounded-xl bg-ivory p-4 text-sm text-ink/65">{copy.noPackages}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-3">{packages.map((item) => { const reason = packageBlockReason(item); return <label key={item.id} className={`rounded-2xl border p-4 ${reason ? 'cursor-not-allowed border-line opacity-60' : 'cursor-pointer'} ${packageId === item.id ? 'border-moss bg-sage/20' : 'border-line'}`} title={reason ?? undefined}><input className="sr-only" type="radio" name="package" value={item.id} checked={packageId === item.id} disabled={Boolean(reason)} onChange={() => changePackage(item.id)} /><span className="block font-semibold">{item.name}</span><span className="mt-2 block text-sm">{rupiah(item.priceIdr)}</span><span className="mt-1 block text-xs text-ink/50">{item.durationDays} {locale === 'id' ? 'hari' : 'days'}</span>{reason && <span className="mt-2 block text-xs leading-5 text-rose">{reason}</span>}</label>; })}</div>}</fieldset>
    <fieldset className="rounded-2xl border border-line p-4"><legend className="px-1 text-sm font-semibold">{copy.contactDetails}</legend><p className="text-xs leading-5 text-ink/55">{copy.contactAtLeastOne}</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">{copy.emailLabel} <span className="font-normal text-ink/45">({copy.optional})</span><input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setContactError(''); }} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 outline-none focus:border-moss" placeholder={copy.emailPlaceholder} /></label><label className="block text-sm font-medium">{copy.whatsapp} <span className="font-normal text-ink/45">({copy.optional})</span><input type="tel" autoComplete="tel" value={whatsapp} onChange={(event) => { setWhatsapp(event.target.value); setContactError(''); }} className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 outline-none focus:border-moss" placeholder="+62 812..." /></label></div>{contactError && <p role="alert" className="mt-3 text-sm text-rose">{contactError}</p>}</fieldset>
    <div className="rounded-2xl border border-line bg-ivory p-4"><label className="block text-sm font-semibold">{copy.voucher} <span className="font-normal text-ink/45">({copy.optional})</span><input type="text" value={voucherCode} onChange={(event) => { setVoucherCode(event.target.value.toUpperCase()); if (appliedVoucher) setAppliedVoucher(null); }} onKeyDown={(event) => { if (event.key === 'Enter') applyVoucher(event); }} className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 uppercase outline-none focus:border-moss" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={voucherBusy || !voucherCode.trim()} onClick={() => applyVoucher()} className="rounded-full border border-moss px-4 py-2 text-sm font-semibold text-moss disabled:opacity-50">{voucherBusy ? copy.voucherChecking : copy.applyVoucher}</button>{appliedVoucher && <button type="button" onClick={clearVoucher} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">{copy.removeVoucher}</button>}</div>{voucherStatus && <p role="status" className={`mt-3 text-sm ${appliedVoucher ? 'text-moss' : 'text-ink/65'}`}>{voucherStatus}</p>}{appliedVoucher && <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm"><div className="flex justify-between"><span>{copy.voucherCode}</span><strong>{appliedVoucher.code}</strong></div><div className="flex justify-between"><span>{copy.discount}</span><strong>-{rupiah(appliedVoucher.discountIdr)}</strong></div></div>}</div>
    <fieldset><legend className="text-sm font-semibold">{copy.paymentMethod}</legend>
      {!methodsLoaded ? <p className="mt-3 text-sm text-ink/55">{copy.loadingMethods}</p> : methodsFailed ? <p role="alert" className="mt-3 text-sm text-ink/65">{copy.methodsUnavailable}</p> : methods.length === 0 ? <p className="mt-3 rounded-xl bg-ivory p-4 text-sm text-ink/65">{copy.noMethods}</p> :
        <div className="mt-3 space-y-3">{methods.map((method) => <label key={method.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${paymentMethodId === method.id ? 'border-moss bg-sage/20' : 'border-line hover:border-moss/50'}`}><input type="radio" name="paymentMethod" value={method.id} checked={paymentMethodId === method.id} onChange={() => setPaymentMethodId(method.id)} /><span className="flex min-w-0 flex-1 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-paper text-xs font-bold text-moss">{method.imageUrl ? <img src={method.imageUrl} alt="" className="h-full w-full object-contain p-1" /> : method.name.slice(0, 1).toUpperCase()}</span><span className="truncate font-semibold">{method.name}</span></span></label>)}</div>}
    </fieldset>
    <div className="rounded-2xl bg-ivory p-4 text-sm"><div className="flex justify-between"><span>{copy.paymentMethod}</span><span className="font-semibold">{selectedMethod?.name ?? '—'}</span></div><div className="mt-2 flex justify-between"><span>{copy.basePrice}</span><span className="font-semibold">{selected ? rupiah(selected.priceIdr) : '—'}</span></div>{appliedVoucher && <><div className="mt-2 flex justify-between"><span>{copy.discount}</span><span className="font-semibold text-moss">-{rupiah(appliedVoucher.discountIdr)}</span></div><div className="mt-2 flex justify-between border-t border-line pt-2"><span>{copy.total}</span><span className="font-semibold">{rupiah(currentAmount)}</span></div></>}</div>
    {message && <p role="alert" className="rounded-2xl bg-[#f2dfd8] px-4 py-3 text-sm">{message}</p>}
    <button disabled={busy || voucherBusy || !methodsLoaded || methodsFailed || !selectedMethod || !selected} className="w-full rounded-full bg-moss px-5 py-3.5 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? copy.creatingOrder : copy.createOrder}</button>
  </form></div></div>;
}
