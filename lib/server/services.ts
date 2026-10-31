import {
  resolveEntitlement, canCreateGift, canEditGift, canPublishGift, canUnarchiveGift,
  canArchiveOrDeleteGift, planSubscriptionActivation, canTransitionOrder,
  type Decision, type Entitlement, type SubLike,
} from '../entitlements.ts';
import { generateSlug } from '../slug.ts';
import { validateGiftContent } from '../model/content.ts';
import { planLegacyGiftMigration } from '../model/migrate.ts';
import { DEFAULT_PACKAGES } from '../packages.ts';
import type { GiftContent, PackageDoc, PackageId, TemplateTier } from '../model/types.ts';
import { ServiceError, guarded, type Doc, type Env, type Tx } from './store.ts';

/**
 * Server-side authorization and state changes. Every function runs inside one
 * transaction: it reads the caller's subscriptions with the SERVER clock,
 * applies the pure entitlement rules, then writes. Route handlers pass the
 * identity taken from the verified session cookie, never from the request body.
 *
 * MODEL B: nothing here reads subscriptions on a public-read path. Expiry only
 * affects create/edit/publish/unarchive. Archive and delete stay available.
 */

export type TemplateInfo = {
  id: string; tier: TemplateTier; version: number;
  /** Template-specific structural check (unknown fields, limits, section order). Null means valid. */
  validateContent?: (content: GiftContent) => string | null;
  /** Keys still missing before this content may be published. */
  missingForPublish?: (content: GiftContent) => string[];
};
/**
 * Without `version`: the newest ACTIVE template (creating, catalog).
 * With `version`: that exact version whatever its status (existing gifts keep working Model B).
 */
export type TemplateLookup = (id: string, version?: number) => TemplateInfo | null;

function checkAgainstTemplate(tpl: TemplateInfo, content: GiftContent): void {
  const err = tpl.validateContent?.(content);
  if (err) throw new ServiceError(400, 'invalid_content', err);
}
export type Actor = { uid: string; admin: boolean };

const statusFor = (d: Decision): number =>
  d.allowed ? 200 : d.reason === 'not_owner' ? 403 : d.reason === 'gift_deleted' ? 404 : 403;
function enforce(d: Decision): void {
  if (!d.allowed) throw new ServiceError(statusFor(d), d.reason);
}

type SubWithId = SubLike & { id: string; orderId?: string };

async function loadEntitlement(env: Env, tx: Tx, uid: string): Promise<Entitlement<SubWithId>> {
  const rows = await tx.query('subscriptions', 'userId', uid);
  const subs = rows.map((r) => ({ ...(r.data as SubLike), id: r.id }));
  return resolveEntitlement(subs, env.nowMs());
}

/** Reads a gift and, if it predates schema v2, upgrades the in-memory copy (additive). */
function normalizeGift(env: Env, giftId: string, raw: Doc | null): { gift: Doc; legacy: boolean } {
  if (!raw) throw new ServiceError(404, 'gift_not_found');
  if (raw.schemaVersion === 2) return { gift: raw, legacy: false };
  const plan = planLegacyGiftMigration(raw, (ms) => env.ts(ms), env.nowMs());
  if (plan.action !== 'migrate') throw new ServiceError(409, 'gift_needs_manual_review', giftId);
  return { gift: { ...raw, ...plan.patch }, legacy: true };
}

/**
 * Persist a gift change. A legacy document is written in full (original fields
 * kept, v2 fields added) so the migration is persisted together with the edit;
 * a v2 document gets a targeted update.
 */
function writeGift(tx: Tx, giftId: string, gift: Doc, legacy: boolean, patch: Doc): void {
  if (legacy) tx.set(`gifts/${giftId}`, { ...gift, ...patch });
  else tx.update(`gifts/${giftId}`, patch);
}

const requireContent = (input: unknown): GiftContent => {
  const r = validateGiftContent(input);
  if (!r.ok) throw new ServiceError(r.code === 'media_unavailable' ? 403 : 400, r.code, r.detail);
  return r.content;
};

/* ------------------------------ Gifts ------------------------------ */

export function createGift(env: Env, actor: Actor, input: { templateId: unknown; content: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const template = typeof input.templateId === 'string' ? lookup(input.templateId) : null;
    if (!template) throw new ServiceError(400, 'unknown_template');
    const content = requireContent(input.content);
    checkAgainstTemplate(template, content);

    const ent = await loadEntitlement(env, tx, actor.uid);
    let used = 0;
    if (ent.current) used = (await tx.query('gifts', 'createdUnderSubscriptionId', ent.current.id)).length;
    enforce(canCreateGift(ent, { giftsCreatedUnderCurrent: used, templateTier: template.tier }));

    let slug = '';
    for (let i = 0; i < 6 && !slug; i++) {
      const candidate = generateSlug();
      if ((await tx.get(`slugs/${candidate}`)) === null) slug = candidate;
    }
    if (!slug) throw new ServiceError(503, 'slug_allocation_failed');

    const now = env.ts(env.nowMs());
    const giftId = env.newId();
    tx.create(`gifts/${giftId}`, {
      ownerUid: actor.uid, templateId: template.id, templateVersion: template.version, slug, status: 'draft',
      draft: { content, version: 1, updatedAt: now }, publishedRevision: null, publishedAt: null,
      createdUnderSubscriptionId: ent.current!.id, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null, schemaVersion: 2,
    });
    tx.create(`slugs/${slug}`, { giftId, ownerUid: actor.uid, createdAt: now });
    return { giftId, slug, version: 1 };
  }));
}

export function saveDraft(env: Env, actor: Actor, giftId: string,
  input: { expectedVersion: unknown; content: unknown; templateId?: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const ent = await loadEntitlement(env, tx, actor.uid);
    const { gift, legacy } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    enforce(canEditGift(ent, { ownerUid: gift.ownerUid, status: gift.status }, actor.uid));
    const content = requireContent(input.content);
    if (!Number.isInteger(input.expectedVersion)) throw new ServiceError(400, 'invalid_version');
    if (gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));

    const patch: Doc = {};
    let tpl: TemplateInfo | null;
    if (gift.templateId === null) {
      // Migrated legacy draft: the owner must pick a template once, within package rules.
      const t = typeof input.templateId === 'string' ? lookup(input.templateId) : null;
      if (!t) throw new ServiceError(400, 'template_required');
      if (!ent.limits!.allowedTemplateTiers.includes(t.tier)) throw new ServiceError(403, 'template_not_in_package');
      patch.templateId = t.id; patch.templateVersion = t.version;
      tpl = t;
    } else {
      // Validate against the exact version the gift was made with, even if that template is now inactive.
      tpl = lookup(gift.templateId, gift.templateVersion);
      if (!tpl) throw new ServiceError(409, 'template_unavailable');
    }
    checkAgainstTemplate(tpl, content);
    const now = env.ts(env.nowMs());
    const version = gift.draft.version + 1;
    writeGift(tx, giftId, gift, legacy, { ...patch, draft: { content, version, updatedAt: now }, updatedAt: now });
    return { version };
  }));
}

/** Owner-only draft read. Expired owners may still view their private gift, but cannot save it. */
export function getGiftDraft(env: Env, actor: Actor, giftId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const { gift } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    if (gift.ownerUid !== actor.uid) throw new ServiceError(403, 'not_owner');
    if (gift.status === 'deleted') throw new ServiceError(404, 'gift_deleted');

    const entitlement = await loadEntitlement(env, tx, actor.uid);
    const permission = canEditGift(entitlement, { ownerUid: gift.ownerUid, status: gift.status }, actor.uid);
    const content = requireContent(gift.draft.content);
    return {
      giftId,
      templateId: typeof gift.templateId === 'string' ? gift.templateId : null,
      templateVersion: Number.isInteger(gift.templateVersion) ? gift.templateVersion : 1,
      status: gift.status,
      draft: {
        content,
        version: Number.isInteger(gift.draft.version) ? gift.draft.version : 1,
        updatedAtMs: gift.draft.updatedAt?.toMillis?.() ?? env.nowMs(),
      },
      editable: permission.allowed,
      reason: permission.allowed ? null : permission.reason,
      entitlement: { state: entitlement.state, expiresAtMs: entitlement.expiresAtMs },
    };
  }));
}

export function publishGift(env: Env, actor: Actor, giftId: string, input: { expectedVersion: unknown }, lookup?: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const ent = await loadEntitlement(env, tx, actor.uid);
    const { gift, legacy } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    enforce(canPublishGift(ent, { ownerUid: gift.ownerUid, status: gift.status }, actor.uid));
    if (gift.templateId === null) throw new ServiceError(409, 'template_required');
    // Publish exactly the version the owner previewed, never a newer partial save.
    if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) {
      throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
    }
    const content = requireContent(gift.draft.content);
    if (lookup) {
      const tpl = lookup(gift.templateId, gift.templateVersion);
      if (!tpl) throw new ServiceError(409, 'template_unavailable');
      checkAgainstTemplate(tpl, content);
      const missing = tpl.missingForPublish?.(content) ?? [];
      if (missing.length) throw new ServiceError(422, 'incomplete_content', missing.join(','));
    }
    const pub = await tx.get(`publicGifts/${gift.slug}`);
    if (pub?.status === 'removed') throw new ServiceError(403, 'removed_by_policy');

    const now = env.ts(env.nowMs());
    const revision = (gift.publishedRevision ?? 0) + 1;
    const publishedAt = gift.publishedAt ?? now;
    tx.create(`gifts/${giftId}/revisions/${revision}`, { number: revision, content, templateId: gift.templateId, templateVersion: gift.templateVersion, createdAt: now });
    tx.set(`publicGifts/${gift.slug}`, {
      slug: gift.slug, status: 'published', templateId: gift.templateId, templateVersion: gift.templateVersion,
      revision, content, publishedAt, updatedAt: now, schemaVersion: 2,
    });
    const g = { status: 'published', publishedRevision: revision, publishedAt, updatedAt: now, archivedAt: null };
    writeGift(tx, giftId, gift, legacy, g);
    return { slug: gift.slug, revision };
  }));
}

export function archiveGift(env: Env, actor: Actor, giftId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const { gift, legacy } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    enforce(canArchiveOrDeleteGift({ ownerUid: gift.ownerUid, status: gift.status }, actor.uid));
    const pub = gift.publishedRevision != null ? await tx.get(`publicGifts/${gift.slug}`) : null;
    const now = env.ts(env.nowMs());
    const g = { status: 'archived', archivedAt: now, updatedAt: now };
    writeGift(tx, giftId, gift, legacy, g);
    if (pub && pub.status === 'published') tx.update(`publicGifts/${gift.slug}`, { status: 'archived', updatedAt: now });
    return { status: 'archived' };
  }));
}

export function unarchiveGift(env: Env, actor: Actor, giftId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const ent = await loadEntitlement(env, tx, actor.uid);
    const { gift, legacy } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    enforce(canUnarchiveGift(ent, { ownerUid: gift.ownerUid, status: gift.status }, actor.uid));
    const pub = gift.publishedRevision != null ? await tx.get(`publicGifts/${gift.slug}`) : null;
    const now = env.ts(env.nowMs());
    const status = gift.publishedRevision != null ? 'published' : 'draft';
    const g = { status, archivedAt: null, updatedAt: now };
    writeGift(tx, giftId, gift, legacy, g);
    // A policy removal is never reversed by the owner.
    if (pub && pub.status === 'archived') tx.update(`publicGifts/${gift.slug}`, { status: 'published', updatedAt: now });
    return { status };
  }));
}

/**
 * Soft delete: the public document becomes an empty tombstone (content erased,
 * slug stays reserved so the URL can never be reassigned). The private draft
 * and revisions are kept for now; permanent erasure is a later, explicit step.
 */
export function deleteGift(env: Env, actor: Actor, giftId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const { gift, legacy } = normalizeGift(env, giftId, await tx.get(`gifts/${giftId}`));
    enforce(canArchiveOrDeleteGift({ ownerUid: gift.ownerUid, status: gift.status }, actor.uid));
    const pub = gift.publishedRevision != null ? await tx.get(`publicGifts/${gift.slug}`) : null;
    const now = env.ts(env.nowMs());
    const g = { status: 'deleted', deletedAt: now, updatedAt: now };
    writeGift(tx, giftId, gift, legacy, g);
    if (pub) tx.update(`publicGifts/${gift.slug}`, { status: 'removed', content: { fields: {}, sections: [], data: {}, media: [] }, updatedAt: now });
    return { status: 'deleted' };
  }));
}

/* ------------------------- Orders & subscriptions ------------------------- */

const MAX_OPEN_ORDERS = 3;

export function createOrder(env: Env, actor: Actor, packageId: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (packageId !== 'basic' && packageId !== 'plus' && packageId !== 'premium') throw new ServiceError(400, 'unknown_package');
    const id: PackageId = packageId;
    // Price and duration come from the server's package record, never from the client.
    const stored = (await tx.get(`packages/${id}`)) as PackageDoc | null;
    const pkg = stored ?? DEFAULT_PACKAGES.find((p) => p.id === id)!;
    if (!pkg.active) throw new ServiceError(400, 'package_unavailable');

    const open = (await tx.query('orders', 'userId', actor.uid))
      .filter((o) => o.data.status === 'awaiting_payment' || o.data.status === 'proof_submitted').length;
    if (open >= MAX_OPEN_ORDERS) throw new ServiceError(429, 'too_many_open_orders');

    const now = env.ts(env.nowMs());
    const orderId = env.newId();
    tx.create(`orders/${orderId}`, {
      userId: actor.uid, packageId: id,
      packageSnapshot: { packageId: id, name: pkg.name, priceIdr: pkg.priceIdr, durationDays: pkg.durationDays, limits: pkg.limits },
      amountIdr: pkg.priceIdr, status: 'awaiting_payment', proof: null, reviewedBy: null, reviewedAt: null,
      rejectionReason: null, subscriptionId: null, createdAt: now, updatedAt: now, schemaVersion: 2,
    });
    return { orderId, amountIdr: pkg.priceIdr };
  }));
}

function requireAdmin(actor: Actor) {
  if (!actor.admin) throw new ServiceError(403, 'admin_required');
}

/**
 * The ONLY place a subscription is created. Requires an admin actor and an
 * order whose proof has been submitted. Idempotent: the subscription id is
 * derived from the order id and written with create(), so approving twice
 * cannot grant two periods.
 */
export function approveOrder(env: Env, actor: Actor, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const order = await tx.get(`orders/${orderId}`);
    if (!order) throw new ServiceError(404, 'order_not_found');
    const plan = planSubscriptionActivation({ status: order.status, packageSnapshot: order.packageSnapshot }, env.nowMs());
    if (!plan.ok) throw new ServiceError(409, plan.reason);

    const now = env.ts(env.nowMs());
    const subscriptionId = `sub_${orderId}`;
    tx.create(`subscriptions/${subscriptionId}`, {
      userId: order.userId, packageId: order.packageId, orderId, status: 'active',
      startedAt: env.ts(plan.startedAtMs), expiresAt: env.ts(plan.expiresAtMs), packageSnapshot: plan.packageSnapshot,
      createdAt: now, updatedAt: now, schemaVersion: 2,
    });
    tx.update(`orders/${orderId}`, { status: 'approved', reviewedBy: actor.uid, reviewedAt: now, subscriptionId, updatedAt: now });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.approve', actorUid: actor.uid, orderId, subscriptionId, at: now });
    return { subscriptionId, expiresAtMs: plan.expiresAtMs };
  }));
}

export function rejectOrder(env: Env, actor: Actor, orderId: string, reason: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const text = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (!text) throw new ServiceError(400, 'reason_required');
    const order = await tx.get(`orders/${orderId}`);
    if (!order) throw new ServiceError(404, 'order_not_found');
    if (!canTransitionOrder(order.status, 'rejected')) throw new ServiceError(409, 'order_not_reviewable');
    const now = env.ts(env.nowMs());
    tx.update(`orders/${orderId}`, { status: 'rejected', reviewedBy: actor.uid, reviewedAt: now, rejectionReason: text, updatedAt: now });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.reject', actorUid: actor.uid, orderId, at: now });
    return { status: 'rejected' };
  }));
}
