import { isValidCustomSlug, normalizeCustomSlug, generateSlug } from '../slug.ts';
import { createEditToken, guestOwnerId, hashEditToken, verifyEditToken } from '../security/edit-token.ts';
import { validateGiftContent } from '../model/content.ts';
import { publicPresentationContent } from '../model/public-content.ts';
import { ServiceError, guarded, type Doc, type Env, type Tx } from './store.ts';
import { consumeRateLimit, type RateLimitPolicy } from '../security/rate-limit.ts';
import type { GiftContent, ProofAiAnalysis } from '../model/types.ts';
import type { TemplateLookup } from './services.ts';
import { canPublishGift, isSubscriptionActive, resolveEntitlement, type SubLike } from '../entitlements.ts';
import { DEFAULT_PACKAGES } from '../packages.ts';
import { DEFAULT_QRIS_DISPLAY, isVerifiedQrisImagePath, normalizeVoucherCode, validateQrisDisplay, validateVoucher, validateVoucherDefinition, type PaymentMethodDoc, type VoucherDoc } from '../commerce.ts';

const GUEST_EDIT_DAYS = 30;
const GUEST_SLUG_HOLD_MS = 48 * 60 * 60 * 1000;
const GUEST_READ_POLICY: RateLimitPolicy = { max: 180, windowMs: 60_000 };
const GUEST_WRITE_POLICY: RateLimitPolicy = { max: 120, windowMs: 60_000 };
const GUEST_SLUG_POLICY: RateLimitPolicy = { max: 60, windowMs: 60_000 };
const GUEST_ACTION_POLICY: RateLimitPolicy = { max: 10, windowMs: 60 * 60_000 };
async function enforceGuestRateLimit(tx: Tx, env: Env, scope: string, ownerUid: string, policy: RateLimitPolicy): Promise<void> {
  const result = await consumeRateLimit(tx, scope, ownerUid, env.nowMs(), policy);
  if (!result.ok) throw new ServiceError(429, 'rate_limited', String(Math.ceil(result.retryAfterMs / 1000)));
}
const contentOf = (input: unknown, mediaEnabled = false): GiftContent => {
  const result = validateGiftContent(input, { mediaEnabled });
  if (!result.ok) throw new ServiceError(result.code === 'media_unavailable' ? 403 : 400, result.code, result.detail);
  return result.content;
};

function millis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return null;
}
async function findGiftBySlug(tx: Tx, slug: string): Promise<{ id: string; data: Doc } | null> {
  const rows = await tx.query('gifts', 'slug', slug);
  return rows[0] ?? null;
}
async function hasActiveSlugOwner(tx: Tx, env: Env, gift: Doc): Promise<boolean> {
  if (gift.status === 'deleted') return false;
  if (gift.publishedRevision !== null && gift.publishedRevision !== undefined) return true;
  const orders = await tx.query('orders', 'giftId', gift.id ?? '');
  return orders.some(({ data }) => {
    if (data.deletedAt) return false;
    if (data.status === 'approved' || data.status === 'proof_submitted') return true;
    if (data.status !== 'awaiting_payment') return false;
    const createdAt = millis(data.createdAt);
    return createdAt !== null && env.nowMs() < createdAt + GUEST_SLUG_HOLD_MS;
  });
}
async function nextReplacementSlug(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateSlug();
    const [reservation, gift] = await Promise.all([tx.get(`slugs/${candidate}`), findGiftBySlug(tx, candidate)]);
    if (!reservation && !gift) return candidate;
  }
  throw new ServiceError(503, 'slug_allocation_failed');
}
type SlugClaim = { available: boolean; reclaimGiftId?: string; replacementSlug?: string };
async function inspectSlugClaim(tx: Tx, env: Env, slug: string, giftId: string): Promise<SlugClaim> {
  const reservation = await tx.get(`slugs/${slug}`);
  const reservedGift = reservation && typeof reservation.giftId === 'string' && reservation.giftId !== giftId ? await tx.get(`gifts/${reservation.giftId}`) : null;
  const row = reservedGift && reservation && reservedGift.slug === slug ? { id: reservation.giftId, data: reservedGift } : await findGiftBySlug(tx, slug);
  if (!row || row.id === giftId) return { available: true };
  if (await hasActiveSlugOwner(tx, env, { ...row.data, id: row.id })) return { available: false };
  return { available: true, reclaimGiftId: row.id, replacementSlug: await nextReplacementSlug(tx) };
}
async function reserveSlug(tx: Tx, requested: unknown, ownerUid: string, giftId: string, now: ReturnType<Env['ts']>, env: Env): Promise<string> {
  const custom = normalizeCustomSlug(requested);
  if (requested !== undefined && (typeof requested !== 'string' || !isValidCustomSlug(custom))) {
    throw new ServiceError(400, 'invalid_custom_slug');
  }
  const candidates = custom ? [custom] : Array.from({ length: 6 }, () => generateSlug());
  for (const slug of candidates) {
    if (!isValidCustomSlug(slug) && !/^[a-z0-9]{12}$/.test(slug)) continue;
    const claim = await inspectSlugClaim(tx, env, slug, giftId);
    if (claim.available && !claim.reclaimGiftId && (await tx.get(`slugs/${slug}`)) === null) {
      tx.create(`slugs/${slug}`, { giftId, ownerUid, createdAt: now, expiresAt: env.ts(env.nowMs() + GUEST_EDIT_DAYS * 86_400_000), orderId: null });
      return slug;
    }
    if (claim.available && claim.reclaimGiftId && claim.replacementSlug) {
      tx.update(`gifts/${claim.reclaimGiftId}`, { slug: claim.replacementSlug, updatedAt: now });
      tx.set(`slugs/${claim.replacementSlug}`, { giftId: claim.reclaimGiftId, ownerUid, createdAt: now, expiresAt: env.ts(env.nowMs() + GUEST_EDIT_DAYS * 86_400_000), orderId: null });
      tx.set(`slugs/${slug}`, { giftId, ownerUid, createdAt: now, expiresAt: env.ts(env.nowMs() + GUEST_EDIT_DAYS * 86_400_000), orderId: null });
      return slug;
    }
  }
  throw new ServiceError(custom ? 409 : 503, custom ? 'slug_unavailable' : 'slug_allocation_failed');
}

export function createGuestGift(env: Env, input: { templateId: unknown; content: unknown; customSlug?: unknown; email?: unknown; whatsapp?: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const template = typeof input.templateId === 'string' ? lookup(input.templateId) : null;
    if (!template) throw new ServiceError(400, 'unknown_template');
    const content = contentOf(input.content);
    const structuralError = template.validateContent?.(content);
    if (structuralError) throw new ServiceError(400, 'invalid_content', structuralError);
    const token = createEditToken();
    const ownerUid = guestOwnerId(token);
    const giftId = env.newId();
    const nowMs = env.nowMs();
    const now = env.ts(nowMs);
    const expiresAt = env.ts(nowMs + GUEST_EDIT_DAYS * 86_400_000);
    const slug = await reserveSlug(tx, input.customSlug, ownerUid, giftId, now, env);
    tx.create(`gifts/${giftId}`, {
      ownerUid, editTokenHash: hashEditToken(token), editTokenExpiresAt: expiresAt,
      customerEmail: typeof input.email === 'string' ? input.email.trim().slice(0, 200) : null,
      customerWhatsapp: typeof input.whatsapp === 'string' ? input.whatsapp.trim().slice(0, 40) : null,
      templateId: template.id, templateVersion: template.version, slug, status: 'draft',
      draft: { content, version: 1, updatedAt: now }, publishedRevision: null, publishedAt: null,
      createdUnderSubscriptionId: null, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null, schemaVersion: 2,
    });
    return { giftId, slug, version: 1, editToken: token, editTokenExpiresAtMs: nowMs + GUEST_EDIT_DAYS * 86_400_000 };
  }));
}

/** Validate a checkout slug against the reservation table after proving draft ownership. */
export function checkGuestSlugAvailability(env: Env, giftId: string, token: unknown, requested: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (typeof requested !== 'string') throw new ServiceError(400, 'invalid_custom_slug');
    const slug = normalizeCustomSlug(requested);
    if (!isValidCustomSlug(slug)) throw new ServiceError(400, 'invalid_custom_slug');
    const gift = await loadGuest(tx, env, giftId, token);
    if (gift.publishedRevision !== null) throw new ServiceError(409, 'slug_locked');
    if (slug !== String(gift.slug)) {
      const existingOrders = await tx.query('orders', 'giftId', giftId);
      if (existingOrders.some(({ data }) => data.status === 'proof_submitted' || data.status === 'approved' || (data.status === 'awaiting_payment' && !data.deletedAt && (millis(data.createdAt) === null || env.nowMs() < millis(data.createdAt)! + GUEST_SLUG_HOLD_MS)))) {
        throw new ServiceError(409, 'slug_locked');
      }
    }
    const claim = await inspectSlugClaim(tx, env, slug, giftId);
    await enforceGuestRateLimit(tx, env, 'guest-slug-check', gift.ownerUid, GUEST_SLUG_POLICY);
    return { slug, available: claim.available };
  }));
}

async function loadGuest(tx: Tx, env: Env, giftId: string, token: unknown): Promise<Doc> {
  const gift = await tx.get(`gifts/${giftId}`);
  if (!gift) throw new ServiceError(404, 'edit_link_invalid');
  let tokenMatched = verifyEditToken(token, gift.editTokenHash);
  let expiresAt = tokenMatched ? gift.editTokenExpiresAt?.toMillis?.() : null;
  if (!tokenMatched && typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const link = await tx.get(`guestEditLinks/${hashEditToken(token)}`);
    if (link && link.giftId === giftId && link.ownerUid === gift.ownerUid && link.revokedAt == null && verifyEditToken(token, hashEditToken(token))) {
      tokenMatched = true;
      expiresAt = link.expiresAt?.toMillis?.();
    }
  }
  if (!tokenMatched) throw new ServiceError(404, 'edit_link_invalid');
  if (typeof expiresAt !== 'number' || env.nowMs() >= expiresAt) throw new ServiceError(403, 'edit_link_expired');
  if (gift.status === 'deleted') throw new ServiceError(404, 'gift_deleted');
  return { ...gift, authorizedEditExpiresAtMs: expiresAt };
}

/** Shared strictly token-authorized loader for server-side media operations. */
export function loadGuestForMedia(tx: Tx, env: Env, giftId: string, token: unknown): Promise<Doc> {
  return loadGuest(tx, env, giftId, token);
}

/** Resolve a bearer edit URL to its gift without persisting or returning the raw token. */
export function resolveGuestEditToken(env: Env, token: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ServiceError(404, 'edit_link_invalid');
    const tokenHash = hashEditToken(token);
    const matches = await tx.query('gifts', 'editTokenHash', tokenHash);
    const row = matches.find(({ data }) => verifyEditToken(token, data.editTokenHash));
    let giftId: string;
    let ownerUid: string;
    let expiresAt: number | null;
    if (row) {
      giftId = row.id;
      ownerUid = String(row.data.ownerUid);
      expiresAt = row.data.editTokenExpiresAt?.toMillis?.() ?? null;
    } else {
      const link = await tx.get(`guestEditLinks/${tokenHash}`);
      if (!link || link.revokedAt != null || !verifyEditToken(token, tokenHash) || typeof link.giftId !== 'string' || typeof link.ownerUid !== 'string') throw new ServiceError(404, 'edit_link_invalid');
      giftId = link.giftId;
      ownerUid = link.ownerUid;
      expiresAt = link.expiresAt?.toMillis?.() ?? null;
    }
    const gift = await tx.get(`gifts/${giftId}`);
    if (!gift || gift.ownerUid !== ownerUid) throw new ServiceError(404, 'edit_link_invalid');
    if (typeof expiresAt !== 'number' || env.nowMs() >= expiresAt) throw new ServiceError(403, 'edit_link_expired');
    if (gift.status === 'deleted') throw new ServiceError(404, 'gift_deleted');
    await enforceGuestRateLimit(tx, env, 'guest-edit-link-open', ownerUid, GUEST_READ_POLICY);
    return { giftId };
  }));
}

async function loadGuestSubscriptions(tx: Tx, ownerUid: string): Promise<(SubLike & { id: string })[]> {
  const rows = await tx.query('subscriptions', 'userId', ownerUid);
  return rows.map((row) => ({ ...(row.data as SubLike), id: row.id }));
}

export function getGuestGiftDraft(env: Env, giftId: string, token: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await loadGuest(tx, env, giftId, token);
    const nowMs = env.nowMs();
    const subscriptions = await loadGuestSubscriptions(tx, gift.ownerUid);
    await enforceGuestRateLimit(tx, env, 'guest-gift-read', gift.ownerUid, GUEST_READ_POLICY);
    const assigned = subscriptions.find((sub) => sub.id === gift.createdUnderSubscriptionId) ?? null;
    const canPublish = gift.status !== 'archived' && (gift.publishedRevision == null
      ? Boolean(assigned && isSubscriptionActive(assigned, nowMs))
      : resolveEntitlement(subscriptions, nowMs).state === 'active');
    const waitingForSubscription = Boolean(gift.status === 'draft' && gift.publishedRevision == null && assigned && assigned.status === 'active' && assigned.startedAt.toMillis() > nowMs && assigned.expiresAt.toMillis() > nowMs);
    return { giftId, slug: gift.slug, templateId: gift.templateId, templateVersion: gift.templateVersion, status: gift.status,
      publishedRevision: Number.isInteger(gift.publishedRevision) ? gift.publishedRevision : null,
      publication: { canPublish, waitingForSubscription },
      draft: { content: contentOf(gift.draft.content, true), version: gift.draft.version, updatedAtMs: gift.draft.updatedAt?.toMillis?.() ?? nowMs }, editable: true,
      entitlement: { state: 'guest_draft' as const, expiresAtMs: Number(gift.authorizedEditExpiresAtMs ?? gift.editTokenExpiresAt.toMillis()) } };
  }));
}

export function saveGuestGiftDraft(env: Env, giftId: string, token: unknown, input: { expectedVersion: unknown; content: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await loadGuest(tx, env, giftId, token);
    await enforceGuestRateLimit(tx, env, 'guest-gift-save', gift.ownerUid, GUEST_WRITE_POLICY);
    if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
    const content = contentOf(input.content, true);
    for (const media of content.media) {
      if (!media.path.startsWith(`private/${giftId}/`)) throw new ServiceError(400, 'invalid_media_ref');
    }
    const template = lookup(String(gift.templateId), Number(gift.templateVersion));
    if (!template) throw new ServiceError(409, 'template_unavailable');
    const structuralError = template.validateContent?.(content);
    if (structuralError) throw new ServiceError(400, 'invalid_content', structuralError);
    const version = gift.draft.version + 1;
    const now = env.ts(env.nowMs());
    tx.update(`gifts/${giftId}`, { draft: { content, version, updatedAt: now }, updatedAt: now });
    return { version };
  }));
}

export function publishGuestGift(env: Env, giftId: string, token: unknown, input: { expectedVersion: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await loadGuest(tx, env, giftId, token);
    const subscriptions = await loadGuestSubscriptions(tx, gift.ownerUid);
    const nowMs = env.nowMs();
    let entitlement = resolveEntitlement(subscriptions, nowMs);
    if (gift.publishedRevision == null) {
      const assigned = subscriptions.find((sub) => sub.id === gift.createdUnderSubscriptionId);
      if (!assigned) throw new ServiceError(403, 'no_subscription');
      if (!isSubscriptionActive(assigned, nowMs)) {
        throw new ServiceError(403, assigned.status === 'active' && assigned.startedAt.toMillis() > nowMs ? 'subscription_not_started' : 'subscription_expired');
      }
      entitlement = resolveEntitlement([assigned], nowMs);
    }
    const permission = canPublishGift(entitlement, { ownerUid: gift.ownerUid, status: gift.status }, gift.ownerUid);
    if (!permission.allowed) throw new ServiceError(permission.reason === 'gift_deleted' ? 404 : 403, permission.reason);
    if (gift.templateId === null) throw new ServiceError(409, 'template_required');
    if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
    const content = contentOf(gift.draft.content, true);
    const template = lookup(String(gift.templateId), Number(gift.templateVersion));
    if (!template) throw new ServiceError(409, 'template_unavailable');
    const structuralError = template.validateContent?.(content);
    if (structuralError) throw new ServiceError(400, 'invalid_content', structuralError);
    const missing = template.missingForPublish?.(content) ?? [];
    if (missing.length) throw new ServiceError(422, 'incomplete_content', missing.join(','));
    const publicPath = `publicGifts/${gift.slug}`;
    const existingPublic = await tx.get(publicPath);
    if (existingPublic?.status === 'removed') throw new ServiceError(403, 'removed_by_policy');
    await enforceGuestRateLimit(tx, env, 'guest-gift-publish', gift.ownerUid, GUEST_ACTION_POLICY);

    const now = env.ts(nowMs);
    const revision = Number(gift.publishedRevision ?? 0) + 1;
    const publishedAt = gift.publishedAt ?? now;
    tx.create(`gifts/${giftId}/revisions/${revision}`, { number: revision, content, templateId: gift.templateId, templateVersion: gift.templateVersion, createdAt: now });
    tx.set(publicPath, { slug: gift.slug, status: 'published', templateId: gift.templateId, templateVersion: gift.templateVersion, revision, content: publicPresentationContent(gift.templateId, content), publishedAt, updatedAt: now, schemaVersion: 2 });
    tx.update(`gifts/${giftId}`, { status: 'published', publishedRevision: revision, publishedAt, updatedAt: now, archivedAt: null });
    return { slug: String(gift.slug), revision };
  }));
}

function contactEmail(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const email = raw.toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError(400, 'invalid_email');
  return email;
}

function contactWhatsapp(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const whatsapp = raw.slice(0, 40);
  if (!/^\+?[0-9][0-9 .()-]{7,38}$/.test(whatsapp)) throw new ServiceError(400, 'invalid_whatsapp');
  return whatsapp;
}

const GUEST_ORDER_IDEMPOTENCY_MS = 48 * 60 * 60 * 1000;

/** Preview-only voucher validation. It never increments usage; order creation rechecks atomically. */
export function validateGuestVoucher(env: Env, input: { giftId: unknown; editToken: unknown; packageId: unknown; voucherCode: unknown }) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const giftId = typeof input.giftId === 'string' ? input.giftId : '';
    if (!giftId) throw new ServiceError(400, 'gift_required');
    await loadGuest(tx, env, giftId, input.editToken);
    const packageId = input.packageId === 'basic' || input.packageId === 'plus' || input.packageId === 'premium' ? input.packageId : null;
    if (!packageId) throw new ServiceError(400, 'unknown_package');
    const storedPackage = await tx.get(`packages/${packageId}`);
    const pkg = (storedPackage ?? DEFAULT_PACKAGES.find((item) => item.id === packageId)) as typeof DEFAULT_PACKAGES[number] | null;
    if (!pkg || !pkg.active) throw new ServiceError(400, 'package_unavailable');
    const code = normalizeVoucherCode(input.voucherCode);
    if (!code) return { voucherCode: null, originalAmountIdr: pkg.priceIdr, discountIdr: 0, amountIdr: pkg.priceIdr };
    const voucher = await tx.get(`vouchers/${code}`) as VoucherDoc | null;
    if (!voucher) throw new ServiceError(400, 'voucher_invalid');
    if (validateVoucherDefinition(voucher).length) throw new ServiceError(400, 'voucher_invalid');
    const result = validateVoucher(voucher, pkg.priceIdr, env.nowMs());
    if (!result.ok) throw new ServiceError(400, `voucher_${result.reason}`);
    return { voucherCode: result.code, originalAmountIdr: pkg.priceIdr, discountIdr: result.discountIdr, amountIdr: result.finalAmountIdr, discount: voucher.discount };
  }));
}

async function checkoutQrisDisplay(env: Env) {
  try {
    return await env.store.runTransaction(async (tx) => validateQrisDisplay((await tx.get('qrisDisplaySettings/default'))?.config ?? DEFAULT_QRIS_DISPLAY));
  } catch (error) {
    console.warn('[qris-display] checkout settings unavailable; using defaults', error instanceof Error ? error.message.slice(0, 160) : 'unknown_error');
    return DEFAULT_QRIS_DISPLAY;
  }
}

export function createGuestOrder(env: Env, input: { giftId: unknown; editToken: unknown; idempotencyKey: unknown; packageId: unknown; email: unknown; whatsapp: unknown; paymentMethodId: unknown; voucherCode?: unknown; customSlug?: unknown }) {
  return guarded(async () => {
    const qrisDisplay = await checkoutQrisDisplay(env);
    return env.store.runTransaction(async (tx) => {
    const giftId = typeof input.giftId === 'string' ? input.giftId : '';
    if (!giftId) throw new ServiceError(400, 'gift_required');
    const gift = await loadGuest(tx, env, giftId, input.editToken);
    const requestedSlug = input.customSlug === undefined ? String(gift.slug) : normalizeCustomSlug(input.customSlug);
    if (!isValidCustomSlug(requestedSlug)) throw new ServiceError(400, 'invalid_custom_slug');
    const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(idempotencyKey)) throw new ServiceError(400, 'invalid_idempotency_key');
    const idempotencyPath = `guestOrderIdempotency/${hashEditToken(`${gift.ownerUid}:${idempotencyKey}`)}`;
    const priorRequest = await tx.get(idempotencyPath);
    const priorExpiresAtMs = priorRequest?.expiresAt?.toMillis?.();
    if (priorRequest && typeof priorExpiresAtMs === 'number' && priorExpiresAtMs > env.nowMs()) {
      if (priorRequest.ownerUid !== gift.ownerUid || priorRequest.giftId !== giftId) throw new ServiceError(409, 'idempotency_key_conflict');
      const priorOrderId = typeof priorRequest.orderId === 'string' ? priorRequest.orderId : '';
      const priorOrder = priorOrderId ? await tx.get(`orders/${priorOrderId}`) : null;
      if (!priorOrder || priorOrder.userId !== gift.ownerUid || priorOrder.giftId !== giftId) throw new ServiceError(409, 'idempotency_record_invalid');
      if (requestedSlug !== String(gift.slug)) throw new ServiceError(409, 'slug_locked');
      await enforceGuestRateLimit(tx, env, 'guest-order-create', gift.ownerUid, GUEST_ACTION_POLICY);
      const orderAccessToken = createEditToken();
      const previousHashes = Array.isArray(priorOrder.orderAccessTokenPreviousHashes)
        ? priorOrder.orderAccessTokenPreviousHashes.filter((hash: unknown): hash is string => typeof hash === 'string')
        : [];
      const currentHash = typeof priorOrder.orderAccessTokenHash === 'string' ? priorOrder.orderAccessTokenHash : '';
      tx.update(`orders/${priorOrderId}`, {
        orderAccessTokenHash: hashEditToken(orderAccessToken),
        orderAccessTokenPreviousHashes: [...(currentHash ? [currentHash] : []), ...previousHashes].slice(-4),
      });
      return {
        orderId: priorOrderId, orderAccessToken,
        amountIdr: Number(priorOrder.amountIdr),
        originalAmountIdr: Number(priorOrder.originalAmountIdr ?? priorOrder.packageSnapshot?.priceIdr ?? priorOrder.amountIdr),
        discountIdr: Number(priorOrder.discountIdr ?? 0),
        paymentMethodId: String(priorOrder.paymentMethodId), status: String(priorOrder.status),
      };
    }
    const packageId = input.packageId === 'basic' || input.packageId === 'plus' || input.packageId === 'premium' ? input.packageId : null;
    if (!packageId) throw new ServiceError(400, 'unknown_package');
    const storedPackage = await tx.get(`packages/${packageId}`);
    const pkg = (storedPackage ?? DEFAULT_PACKAGES.find((item) => item.id === packageId)) as typeof DEFAULT_PACKAGES[number] | null;
    if (!pkg || !pkg.active) throw new ServiceError(400, 'package_unavailable');
    const draftContent = contentOf(gift.draft.content, true);
    const photoCount = draftContent.media.filter((media) => media.kind === 'image').length;
    if (photoCount > Number(pkg.limits?.maxPhotos)) {
      throw new ServiceError(400, 'package_photo_limit_exceeded', `${photoCount}/${pkg.limits?.maxPhotos}`);
    }
    if (draftContent.media.some((media) => media.kind === 'audio') && pkg.limits?.music !== true) {
      throw new ServiceError(400, 'package_music_not_included');
    }
    const paymentMethodId = typeof input.paymentMethodId === 'string' ? input.paymentMethodId.trim().slice(0, 80) : '';
    if (!paymentMethodId) throw new ServiceError(400, 'payment_method_required');
    const storedMethod = await tx.get(`paymentMethods/${paymentMethodId}`) as PaymentMethodDoc | null;
    if (!storedMethod || !storedMethod.active) throw new ServiceError(400, 'payment_method_unavailable');
    if (storedMethod.paymentType === 'qris' && (storedMethod.qrisDetectionStatus !== 'confirmed' || !isVerifiedQrisImagePath(storedMethod.imagePath) || !storedMethod.imageUrl)) {
      throw new ServiceError(400, 'payment_method_unavailable');
    }
    const email = contactEmail(input.email);
    const whatsapp = contactWhatsapp(input.whatsapp);
    if (!email && !whatsapp) throw new ServiceError(400, 'contact_required');
    let customSlugClaim: SlugClaim | null = null;
    if (requestedSlug !== String(gift.slug)) {
      if (gift.publishedRevision !== null || gift.status !== 'draft') throw new ServiceError(409, 'slug_locked');
      const existingOrders = await tx.query('orders', 'giftId', giftId);
      if (existingOrders.some(({ data }) => data.status === 'proof_submitted' || data.status === 'approved' || (data.status === 'awaiting_payment' && !data.deletedAt && (millis(data.createdAt) === null || env.nowMs() < millis(data.createdAt)! + GUEST_SLUG_HOLD_MS)))) {
        throw new ServiceError(409, 'slug_locked');
      }
      customSlugClaim = await inspectSlugClaim(tx, env, requestedSlug, giftId);
      if (!customSlugClaim.available) throw new ServiceError(409, 'slug_unavailable');
    }
    const originalAmountIdr = pkg.priceIdr;
    const voucherCode = normalizeVoucherCode(input.voucherCode);
    let voucher: VoucherDoc | null = null;
    let discountIdr = 0;
    if (voucherCode) {
      voucher = await tx.get(`vouchers/${voucherCode}`) as VoucherDoc | null;
      if (!voucher) throw new ServiceError(400, 'voucher_invalid');
      if (validateVoucherDefinition(voucher).length) throw new ServiceError(400, 'voucher_invalid');
      const result = validateVoucher(voucher, originalAmountIdr, env.nowMs());
      if (!result.ok) throw new ServiceError(400, `voucher_${result.reason}`);
      discountIdr = result.discountIdr;
    }
    await enforceGuestRateLimit(tx, env, 'guest-order-create', gift.ownerUid, GUEST_ACTION_POLICY);
    const nowMs = env.nowMs();
    const now = env.ts(nowMs);
    const orderId = env.newId();
    const orderAccessToken = createEditToken();
    if (customSlugClaim?.reclaimGiftId && customSlugClaim.replacementSlug) {
      tx.update(`gifts/${customSlugClaim.reclaimGiftId}`, { slug: customSlugClaim.replacementSlug, updatedAt: now });
      tx.set(`slugs/${customSlugClaim.replacementSlug}`, { giftId: customSlugClaim.reclaimGiftId, ownerUid: gift.ownerUid, createdAt: now, expiresAt: env.ts(nowMs + GUEST_EDIT_DAYS * 86_400_000), orderId: null });
    }
    if (customSlugClaim) tx.set(`slugs/${requestedSlug}`, { giftId, ownerUid: gift.ownerUid, createdAt: now, expiresAt: env.ts(nowMs + GUEST_SLUG_HOLD_MS), orderId });
    if (requestedSlug !== String(gift.slug)) tx.update(`gifts/${giftId}`, { slug: requestedSlug, updatedAt: now });
    if (voucher && voucherCode) tx.update(`vouchers/${voucherCode}`, { usedCount: voucher.usedCount + 1, updatedAt: now });
    tx.create(`orders/${orderId}`, {
      userId: gift.ownerUid, giftId, customerEmail: email, customerWhatsapp: whatsapp,
      packageId, packageSnapshot: { packageId, name: pkg.name, priceIdr: pkg.priceIdr, durationDays: pkg.durationDays, limits: pkg.limits },
      paymentMethodSnapshot: {
        id: paymentMethodId,
        name: String(storedMethod.name),
        instructions: String(storedMethod.instructions),
        paymentType: (['bank_transfer', 'e_wallet', 'qris', 'other'] as const).includes(storedMethod.paymentType as 'bank_transfer' | 'e_wallet' | 'qris' | 'other') ? storedMethod.paymentType : 'other',
        providerName: typeof storedMethod.providerName === 'string' ? storedMethod.providerName : null,
        accountNumber: typeof storedMethod.accountNumber === 'string' ? storedMethod.accountNumber : null,
        accountHolder: typeof storedMethod.accountHolder === 'string' ? storedMethod.accountHolder : null,
        imageUrl: typeof storedMethod.imageUrl === 'string' ? storedMethod.imageUrl : null,
        imagePath: typeof storedMethod.imagePath === 'string' ? storedMethod.imagePath : null,
        qrisDetectionStatus: storedMethod.qrisDetectionStatus,
        ...(storedMethod.paymentType === 'qris' ? { qrisDisplay } : {}),
      },
      orderAccessTokenHash: hashEditToken(orderAccessToken), orderAccessTokenPreviousHashes: [],
      paymentMethodId, voucherCode: voucherCode || null, originalAmountIdr, discountIdr,
      amountIdr: originalAmountIdr - discountIdr, status: 'awaiting_payment', proof: null,
      reviewedBy: null, reviewedAt: null, rejectionReason: null, subscriptionId: null,
      createdAt: now, updatedAt: now, schemaVersion: 2,
    });
    const idempotencyRecord = { ownerUid: gift.ownerUid, giftId, orderId, createdAt: now, expiresAt: env.ts(nowMs + GUEST_ORDER_IDEMPOTENCY_MS), schemaVersion: 1 };
    if (priorRequest) tx.set(idempotencyPath, idempotencyRecord); else tx.create(idempotencyPath, idempotencyRecord);
    return { orderId, orderAccessToken, amountIdr: originalAmountIdr - discountIdr, originalAmountIdr, discountIdr, paymentMethodId, status: 'awaiting_payment' as const };
    });
  });
}

/** Guest status/detail read is authorized by an unguessable token; order ids alone are never credentials. */
export function getGuestOrderDetail(env: Env, rawOrderId: string, accessToken: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    const method = order.paymentMethodSnapshot;
    if (!method || typeof method.name !== 'string' || typeof method.instructions !== 'string') throw new ServiceError(409, 'payment_instructions_unavailable');
    const qrisVerified = method.paymentType === 'qris' && method.qrisDetectionStatus === 'confirmed' && isVerifiedQrisImagePath(method.imagePath);
    let publishedGiftSlug: string | null = null;
    if (order.status === 'approved' && typeof order.giftId === 'string') {
      const gift = await tx.get(`gifts/${order.giftId}`);
      const slug = typeof gift?.slug === 'string' ? gift.slug : '';
      if (gift?.status === 'published' && gift.publishedRevision !== null && slug) {
        const publicGift = await tx.get(`publicGifts/${slug}`);
        if (publicGift?.status === 'published') publishedGiftSlug = slug;
      }
    }
    return { order: {
      orderId: rawOrderId,
      giftId: typeof order.giftId === 'string' ? order.giftId : null,
      giftSlug: publishedGiftSlug,
      packageId: String(order.packageId),
      packageName: String(order.packageSnapshot?.name ?? order.packageId),
      originalAmountIdr: Number(order.originalAmountIdr ?? order.packageSnapshot?.priceIdr ?? order.amountIdr),
      discountIdr: Number(order.discountIdr ?? 0),
      amountIdr: Number(order.amountIdr),
      voucherCode: typeof order.voucherCode === 'string' ? order.voucherCode : null,
      paymentMethod: {
        name: method.name,
        instructions: method.instructions,
        paymentType: typeof method.paymentType === 'string' ? method.paymentType : 'other',
        providerName: typeof method.providerName === 'string' ? method.providerName : null,
        accountNumber: typeof method.accountNumber === 'string' ? method.accountNumber : null,
        accountHolder: typeof method.accountHolder === 'string' ? method.accountHolder : null,
        imageUrl: method.paymentType === 'qris' && !qrisVerified ? null : typeof method.imageUrl === 'string' ? method.imageUrl : null,
        qrisDetectionStatus: typeof method.qrisDetectionStatus === 'string' ? method.qrisDetectionStatus : 'not_checked',
        qrisDisplay: method.qrisDisplay,
      },
      status: String(order.status), deletedAtMs: order.deletedAt ? order.deletedAt.toMillis?.() ?? null : null,
      createdAtMs: order.createdAt?.toMillis?.() ?? env.nowMs(),
      updatedAtMs: order.updatedAt?.toMillis?.() ?? env.nowMs(),
    } };
  }));
}

/** Order-token protected image path for a verified QRIS crop; never accepts a path from the client. */
export function getGuestOrderQrisImagePath(env: Env, rawOrderId: string, accessToken: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    const method = order.paymentMethodSnapshot;
    if (method?.paymentType !== 'qris' || method.qrisDetectionStatus !== 'confirmed' || !isVerifiedQrisImagePath(method.imagePath)) {
      throw new ServiceError(404, 'qris_image_unavailable');
    }
    return { imagePath: method.imagePath };
  }));
}

/** Internal upload helper: returns no customer data, only the verified owner key. */
export function getGuestOrderOwnerForProof(env: Env, rawOrderId: string, accessToken: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    if (order.status !== 'awaiting_payment' && order.status !== 'rejected') throw new ServiceError(409, 'order_not_reviewable');
    if (typeof order.userId !== 'string' || !order.userId) throw new ServiceError(409, 'order_owner_missing');
    const method = order.paymentMethodSnapshot ?? {};
    return {
      ownerUid: order.userId,
      expectedAmountIdr: Number(order.amountIdr),
      paymentMethod: {
        name: typeof method.name === 'string' ? method.name : '',
        providerName: typeof method.providerName === 'string' ? method.providerName : null,
        accountNumber: typeof method.accountNumber === 'string' ? method.accountNumber : null,
        accountHolder: typeof method.accountHolder === 'string' ? method.accountHolder : null,
      },
    };
  }));
}

/** Persists Gemini hints only for the current submitted proof; never changes order review status. */
export function saveGuestPaymentProofAnalysis(env: Env, rawOrderId: string, accessToken: unknown, storagePath: string, analysis: ProofAiAnalysis) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    if (order.status !== 'proof_submitted' || order.proof?.storagePath !== storagePath) throw new ServiceError(409, 'proof_changed');
    const bounded = {
      ...analysis,
      recipient: typeof analysis.recipient === 'string' ? analysis.recipient.slice(0, 200) : null,
      accountNumber: typeof analysis.accountNumber === 'string' ? analysis.accountNumber.slice(0, 80) : null,
      paymentDate: typeof analysis.paymentDate === 'string' ? analysis.paymentDate.slice(0, 80) : null,
      transactionId: typeof analysis.transactionId === 'string' ? analysis.transactionId.slice(0, 120) : null,
      notes: Array.isArray(analysis.notes) ? analysis.notes.slice(0, 5).map((note) => String(note).slice(0, 160)) : [],
      analyzedAtMs: env.nowMs(),
      autoApproval: 'not_evaluated' as const,
    };
    tx.update(`orders/${rawOrderId}`, { proofAiVerification: bounded });
    return { saved: true };
  }));
}

/**
 * Records proof metadata only after a server-side Storage upload has completed.
 * The route passes a server-generated path; clients can never choose an
 * arbitrary Storage location or mutate the order status directly.
 */
export function submitGuestPaymentProof(
  env: Env,
  rawOrderId: string,
  accessToken: unknown,
  input: { storagePath: unknown; contentType: unknown; sizeBytes: unknown; fileSha256: unknown },
) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    if (order.status !== 'awaiting_payment' && order.status !== 'rejected') throw new ServiceError(409, 'order_not_reviewable');
    const storagePath = typeof input.storagePath === 'string' ? input.storagePath : '';
    const contentType = typeof input.contentType === 'string' ? input.contentType : '';
    const sizeBytes = Number(input.sizeBytes);
    const fileSha256 = typeof input.fileSha256 === 'string' ? input.fileSha256.toLowerCase() : '';
    const ownerUid = typeof order.userId === 'string' ? order.userId : '';
    const expectedPrefix = `paymentProofs/${ownerUid}/${rawOrderId}/`;
    if (!ownerUid || !storagePath.startsWith(expectedPrefix) || storagePath.includes('..') || !/^[a-zA-Z0-9_./-]+$/.test(storagePath)) throw new ServiceError(400, 'invalid_proof_path');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(contentType)) throw new ServiceError(400, 'invalid_proof_type');
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 5 * 1024 * 1024) throw new ServiceError(400, 'invalid_proof_size');
    if (!/^[a-f0-9]{64}$/.test(fileSha256)) throw new ServiceError(400, 'invalid_proof_hash');
    const proofClaim = await tx.get(`paymentProofClaims/${fileSha256}`);
    if (proofClaim && proofClaim.orderId !== rawOrderId) throw new ServiceError(409, 'proof_already_used');
    const now = env.ts(env.nowMs());
    if (!proofClaim) tx.create(`paymentProofClaims/${fileSha256}`, { orderId: rawOrderId, createdAt: now });
    tx.update(`orders/${rawOrderId}`, { status: 'proof_submitted', proof: { storagePath, contentType, sizeBytes, submittedAt: now }, rejectionReason: null, reviewedBy: null, reviewedAt: null, updatedAt: now });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.proof_submitted', actorUid: ownerUid, orderId: rawOrderId, contentType, sizeBytes, at: now });
    return { status: 'proof_submitted' as const };
  }));
}


/** Owner soft-delete requires this order's current or bounded previous bearer-token hash; no edit-link expiry applies. */
export function deleteGuestOrder(env: Env, rawOrderId: string, accessToken: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawOrderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${rawOrderId}`);
    const previousHashes = Array.isArray(order?.orderAccessTokenPreviousHashes) ? order.orderAccessTokenPreviousHashes : [];
    const tokenMatches = Boolean(order && (verifyEditToken(accessToken, order.orderAccessTokenHash) || previousHashes.some((hash: unknown) => verifyEditToken(accessToken, hash))));
    if (!order || !tokenMatches) throw new ServiceError(404, 'order_not_found');
    if (order.deletedAt) return {};
    const now = env.ts(env.nowMs());
    tx.update(`orders/${rawOrderId}`, { deletedAt: now, deletedByUid: order.userId, updatedAt: now });
    return {};
  }));
}
