import { createHash } from 'node:crypto';
import {
  resolveEntitlement, canCreateGift, canEditGift, canPublishGift, canUnarchiveGift,
  canArchiveOrDeleteGift, planSubscriptionActivation, canTransitionOrder,
  type Decision, type Entitlement, type SubLike,
} from '../entitlements.ts';
import { generateSlug, isValidPublicSlug } from '../slug.ts';
import { createEditToken, hashEditToken } from '../security/edit-token.ts';
import { validateGiftContent } from '../model/content.ts';
import { planLegacyGiftMigration } from '../model/migrate.ts';
import { DEFAULT_PACKAGES } from '../packages.ts';
import { DEFAULT_QRIS_DISPLAY, isVerifiedQrisImagePath, normalizeVoucherCode, publicPaymentMethods, validateQrisDisplay, validateVoucherDefinition, type PaymentMethodDoc, type PaymentMethodType, type QrisDetectionStatus, type QrisDisplayConfig, type VoucherDiscount, type VoucherDoc } from '../commerce.ts';
import type { GiftContent, PackageDoc, PackageId, PackageLimits, PublicGiftDoc, TemplateTier } from '../model/types.ts';
import { ServiceError, guarded, type Doc, type Env, type Tx } from './store.ts';
import { siteUrl } from '../site-url.ts';

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

/**
 * Public read path. It deliberately performs one document read only: a public
 * gift has no owner, order, or subscription dependency (Model B).
 */
export function getPublicGift(env: Env, slug: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!isValidPublicSlug(slug)) throw new ServiceError(404, 'gift_not_found');
    const raw = await tx.get(`publicGifts/${slug}`);
    if (!raw) throw new ServiceError(404, 'gift_not_found');
    const status = raw.status;
    if (status !== 'published') return { slug, status };
    return { publicGift: raw as PublicGiftDoc };
  }));
}

const millis = (value: unknown, fallback: number): number => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis(): number }).toMillis();
  return fallback;
};

export type DashboardGift = {
  giftId: string; slug: string; templateId: string | null; status: string;
  version: number; publishedRevision: number | null; updatedAtMs: number;
  publishedAtMs: number | null; analytics: { totalViews: number; lastViewedAtMs: number | null };
};
export type DashboardData = {
  summary: { total: number; drafts: number; published: number; archived: number; totalViews: number; pendingOrders: number };
  insight: { topGiftId: string | null; topGiftViews: number; publicationRate: number };
  subscription: { packageId: string; expiresAtMs: number } | null;
  gifts: DashboardGift[];
};

/** Owner-only dashboard read. It intentionally returns aggregates, not private draft content. */
export function getDashboardData(env: Env, actor: Actor) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const [giftRows, subscriptions, orders] = await Promise.all([
      tx.query('gifts', 'ownerUid', actor.uid),
      tx.query('subscriptions', 'userId', actor.uid),
      tx.query('orders', 'userId', actor.uid),
    ]);
    const entitlement = resolveEntitlement(subscriptions.map((r) => ({ ...(r.data as SubLike), id: r.id })), env.nowMs());
    const gifts: DashboardGift[] = [];
    for (const row of giftRows) {
      const analytics = await tx.get(`giftAnalytics/${row.data.slug}`);
      gifts.push({
        giftId: row.id, slug: String(row.data.slug), templateId: typeof row.data.templateId === 'string' ? row.data.templateId : null,
        status: String(row.data.status), version: Number(row.data.draft?.version ?? 1),
        publishedRevision: typeof row.data.publishedRevision === 'number' ? row.data.publishedRevision : null,
        updatedAtMs: millis(row.data.updatedAt, env.nowMs()), publishedAtMs: row.data.publishedAt ? millis(row.data.publishedAt, env.nowMs()) : null,
        analytics: { totalViews: Number(analytics?.totalViews ?? 0), lastViewedAtMs: analytics?.lastViewedAt ? millis(analytics.lastViewedAt, env.nowMs()) : null },
      });
    }
    const pendingOrders = orders.filter((r) => r.data.status === 'awaiting_payment' || r.data.status === 'proof_submitted').length;
    const totalViews = gifts.reduce((sum, gift) => sum + gift.analytics.totalViews, 0);
    const topGift = gifts.filter((gift) => gift.analytics.totalViews > 0).sort((a, b) => b.analytics.totalViews - a.analytics.totalViews)[0] ?? null;
    return {
      summary: { total: gifts.length, drafts: gifts.filter((g) => g.status === 'draft').length, published: gifts.filter((g) => g.status === 'published').length, archived: gifts.filter((g) => g.status === 'archived').length, totalViews, pendingOrders },
      insight: { topGiftId: topGift?.giftId ?? null, topGiftViews: topGift?.analytics.totalViews ?? 0, publicationRate: gifts.length ? Math.round((gifts.filter((g) => g.publishedRevision !== null).length / gifts.length) * 100) : 0 },
      subscription: entitlement.current ? { packageId: entitlement.current.packageSnapshot.packageId, expiresAtMs: millis(entitlement.current.expiresAt, env.nowMs()) } : null,
      gifts: gifts.sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    };
  }));
}

/** Owner-only export source. Full draft content stays on this server boundary. */
export function exportDashboardData(env: Env, actor: Actor) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const giftRows = await tx.query('gifts', 'ownerUid', actor.uid);
    const gifts = await Promise.all(giftRows.map(async (row) => {
      const analytics = await tx.get(`giftAnalytics/${row.data.slug}`);
      return {
        giftId: row.id, slug: row.data.slug, status: row.data.status, templateId: row.data.templateId,
        templateVersion: row.data.templateVersion, draftVersion: row.data.draft?.version ?? 1,
        draftContent: row.data.draft?.content ?? null, publishedRevision: row.data.publishedRevision ?? null,
        createdAtMs: millis(row.data.createdAt, env.nowMs()), updatedAtMs: millis(row.data.updatedAt, env.nowMs()),
        totalViews: Number(analytics?.totalViews ?? 0),
      };
    }));
    return { gifts };
  }));
}

/** Public analytics has no identity and only increments an aggregate for a published slug. */
export function recordPublicGiftView(env: Env, slug: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!isValidPublicSlug(slug)) throw new ServiceError(404, 'gift_not_found');
    const pub = await tx.get(`publicGifts/${slug}`);
    if (!pub || pub.status !== 'published') throw new ServiceError(404, 'gift_not_found');
    const existing = await tx.get(`giftAnalytics/${slug}`);
    const now = env.ts(env.nowMs());
    const day = new Date(env.nowMs()).toISOString().slice(0, 10);
    const viewsByDay = { ...((existing?.viewsByDay as Record<string, number> | undefined) ?? {}) };
    viewsByDay[day] = (viewsByDay[day] ?? 0) + 1;
    const data = { slug, totalViews: Number(existing?.totalViews ?? 0) + 1, firstViewedAt: existing?.firstViewedAt ?? now, lastViewedAt: now, viewsByDay, schemaVersion: 1 };
    if (existing) tx.update(`giftAnalytics/${slug}`, data); else tx.create(`giftAnalytics/${slug}`, data);
    return { totalViews: data.totalViews };
  }));
}

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

function paymentMethodDatabaseFailure(error: unknown): ServiceError {
  const value = error as {
    code?: unknown; message?: unknown; schema_name?: unknown; table_name?: unknown;
    column_name?: unknown; constraint_name?: unknown;
  } | null;
  const code = typeof value?.code === 'string' ? value.code : '';
  const message = typeof value?.message === 'string' ? value.message : error instanceof Error ? error.message : String(error);
  const pgMissingColumn = message.match(/column\s+"?([a-z_][a-z0-9_]*)"?\s+of relation\s+"?([a-z_][a-z0-9_]*)"?\s+does not exist/i);
  const postgrestMissingColumn = message.match(/could not find the\s+['"]([a-z_][a-z0-9_]*)['"]\s+column of\s+['"]([a-z_][a-z0-9_]*)['"]/i);
  const column = typeof value?.column_name === 'string' ? value.column_name : pgMissingColumn?.[1] ?? postgrestMissingColumn?.[1] ?? '';
  const table = typeof value?.table_name === 'string' ? value.table_name : pgMissingColumn?.[2] ?? postgrestMissingColumn?.[2] ?? '';
  const expectedPaymentMethodColumns = new Set([
    'id', 'name', 'instructions', 'image_url', 'image_path', 'active', 'sort_order', 'updated_by',
    'created_at', 'updated_at', 'schema_version', 'payment_type', 'provider_name', 'account_number',
    'account_holder', 'qris_detection_status',
  ]);
  const redacted = message
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]')
    .replace(/(service[_ -]?role|anon[_ -]?key|api[_ -]?key|authorization|password|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 400);
  console.error('[payment-methods] database save failed', {
    code: code || undefined,
    schema: typeof value?.schema_name === 'string' ? value.schema_name : undefined,
    table: table || undefined,
    column: column || undefined,
    constraint: typeof value?.constraint_name === 'string' ? value.constraint_name : undefined,
    message: redacted,
  });

  if ((code === '42703' && table === 'payment_methods' && expectedPaymentMethodColumns.has(column))
    || (code === 'PGRST204' && table === 'payment_methods' && expectedPaymentMethodColumns.has(column))) {
    return new ServiceError(503, 'payment_method_schema_outdated');
  }
  if (code === '42P01' && table === 'payment_methods') return new ServiceError(503, 'payment_method_table_missing');
  if (code === '42703' && table === 'admin_audit_logs') return new ServiceError(503, 'payment_method_audit_schema_outdated');
  if (code === '42P01' && table === 'admin_audit_logs') return new ServiceError(503, 'payment_method_audit_table_missing');
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new ServiceError(403, 'payment_method_access_denied');
  }
  if (code === '23502') return new ServiceError(400, 'payment_method_required_field');
  if (code === '23514' || code === '22P02') return new ServiceError(400, 'payment_method_invalid_data');
  if (code === '23505') return new ServiceError(409, 'payment_method_conflict');
  return new ServiceError(500, 'payment_method_save_failed');
}

export type AdminPaymentMethod = PaymentMethodDoc;

function qrisDisplayFromRow(data: Doc | null): QrisDisplayConfig {
  return validateQrisDisplay(data?.config ?? data ?? DEFAULT_QRIS_DISPLAY);
}

/** QRIS styling is additive; an older deployment must still render payment methods. */
async function readQrisDisplaySafe(env: Env): Promise<QrisDisplayConfig> {
  try {
    const result = await env.store.runTransaction(async (tx) => qrisDisplayFromRow(await tx.get('qrisDisplaySettings/default')));
    return result;
  } catch (error) {
    console.warn('[qris-display] settings unavailable; using defaults', error instanceof Error ? error.message.slice(0, 160) : 'unknown_error');
    return DEFAULT_QRIS_DISPLAY;
  }
}

export function getQrisDisplay(env: Env) {
  return guarded(async () => ({ qrisDisplay: await readQrisDisplaySafe(env) }));
}

export function saveQrisDisplay(env: Env, actor: Actor, input: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const config = validateQrisDisplay(input);
    const now = env.ts(env.nowMs());
    tx.set('qrisDisplaySettings/default', { config, updatedAt: now, updatedBy: actor.uid, schemaVersion: 1 });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'qris_display.update', actorUid: actor.uid, at: now });
    return { qrisDisplay: config };
  }));
}

function paymentMethodFromRow(id: string, data: Doc): AdminPaymentMethod {
  return {
    id,
    name: String(data.name),
    instructions: String(data.instructions),
    active: data.active === true,
    sortOrder: Number(data.sortOrder),
    paymentType: (['bank_transfer', 'e_wallet', 'qris', 'other'] as const).includes(data.paymentType as PaymentMethodType) ? data.paymentType as PaymentMethodType : 'other',
    providerName: typeof data.providerName === 'string' ? data.providerName : null,
    accountNumber: typeof data.accountNumber === 'string' ? data.accountNumber : null,
    accountHolder: typeof data.accountHolder === 'string' ? data.accountHolder : null,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    imagePath: typeof data.imagePath === 'string' ? data.imagePath : null,
    qrisDetectionStatus: (['not_checked', 'needs_confirmation', 'confirmed'] as const).includes(data.qrisDetectionStatus as QrisDetectionStatus) ? data.qrisDetectionStatus as QrisDetectionStatus : 'not_checked',
  };
}

/** Public checkout read: active methods only; no admin or customer session is needed. */
export function listActivePaymentMethods(env: Env) {
  return guarded(async () => {
    const result = await env.store.runTransaction(async (tx) => {
    const rows = await tx.query('paymentMethods', 'active', true);
    const methods = rows.map((row) => paymentMethodFromRow(row.id, row.data));
    return { methods: publicPaymentMethods(methods) };
    });
    return { ...result, qrisDisplay: await readQrisDisplaySafe(env) };
  });
}

/** Authenticated management read. Payment method ids remain stable order references. */
export function listAdminPaymentMethods(env: Env, actor: Actor) {
  return guarded(async () => {
    const result = await env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const rows = await tx.query('paymentMethods');
    const methods = rows.map((row) => paymentMethodFromRow(row.id, row.data));
    methods.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return { methods };
    });
    return { ...result, qrisDisplay: await readQrisDisplaySafe(env) };
  });
}

/** Create/update a server-owned payment method; disabling is preferred to deleting. */
export function savePaymentMethod(env: Env, actor: Actor, input: Record<string, unknown>) {
  return guarded(async () => {
    try {
      return await env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const requestedId = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const instructions = typeof input.instructions === 'string' ? input.instructions.trim() : '';
    const active = input.active;
    const requestedSortOrder = input.sortOrder;
    const paymentType = input.paymentType === 'bank_transfer' || input.paymentType === 'e_wallet' || input.paymentType === 'qris' || input.paymentType === 'other' ? input.paymentType : 'other';
    const providerName = typeof input.providerName === 'string' ? input.providerName.trim() : '';
    const accountNumber = typeof input.accountNumber === 'string' ? input.accountNumber.trim() : '';
    const accountHolder = typeof input.accountHolder === 'string' ? input.accountHolder.trim() : '';
    const imageUrl = input.imageUrl === null || input.imageUrl === undefined ? null : typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
    const imagePath = input.imagePath === null || input.imagePath === undefined ? null : typeof input.imagePath === 'string' ? input.imagePath.trim() : '';
    const qrisDetectionStatus: QrisDetectionStatus = paymentType !== 'qris' ? 'not_checked'
      : isVerifiedQrisImagePath(imagePath) && typeof imageUrl === 'string' && imageUrl.startsWith('https://') ? 'confirmed' : 'needs_confirmation';
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new ServiceError(400, 'invalid_payment_method_name');
    if (instructions.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(instructions)) throw new ServiceError(400, 'invalid_payment_instructions');
    if (typeof active !== 'boolean') throw new ServiceError(400, 'invalid_payment_method_status');
    if (providerName.length > 120 || accountNumber.length > 120 || accountHolder.length > 120) throw new ServiceError(400, 'invalid_payment_method_details');
    if (paymentType === 'bank_transfer' && (!providerName || !accountNumber || !accountHolder)) throw new ServiceError(400, 'bank_payment_details_required');
    if (paymentType === 'e_wallet' && (!providerName || !accountNumber)) throw new ServiceError(400, 'ewallet_payment_details_required');
    if (paymentType === 'qris' && active === true && qrisDetectionStatus !== 'confirmed') throw new ServiceError(400, 'qris_image_not_confirmed');
    if (requestedSortOrder !== undefined && (!Number.isInteger(requestedSortOrder) || Number(requestedSortOrder) < 0 || Number(requestedSortOrder) > 9999)) throw new ServiceError(400, 'invalid_payment_method_order');

    if (requestedId && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(requestedId)) throw new ServiceError(400, 'invalid_payment_method_id');
    let id = requestedId;
    if (!id) {
      const base = (providerName || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'payment-method';
      id = base;
      let suffix = 2;
      while (await tx.get(`paymentMethods/${id}`)) id = `${base}-${suffix++}`;
    }
    const path = `paymentMethods/${id}`;
    const existing = await tx.get(path);
    const sortOrder = requestedSortOrder === undefined
      ? existing ? Number(existing.sortOrder ?? 0) : (await tx.query('paymentMethods')).reduce((max, row) => Math.max(max, Number(row.data.sortOrder ?? -1)), -1) + 1
      : Number(requestedSortOrder);
    const now = env.ts(env.nowMs());
    const method: Doc = { name, instructions, active, sortOrder: Number(sortOrder), paymentType, providerName: providerName || null, accountNumber: accountNumber || null, accountHolder: accountHolder || null, imageUrl: imageUrl || null, imagePath: imagePath || null, qrisDetectionStatus, createdAt: existing?.createdAt ?? now, updatedAt: now, updatedBy: actor.uid, schemaVersion: 1 };
    tx.set(path, method);
    tx.create(`adminAuditLogs/${env.newId()}`, { action: existing ? 'payment_method.update' : 'payment_method.create', actorUid: actor.uid, paymentMethodId: id, at: now });
        return { method: paymentMethodFromRow(id, method) };
      });
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw paymentMethodDatabaseFailure(error);
    }
  });
}

const packageIds: readonly PackageId[] = ['basic', 'plus', 'premium'];

function normalizePackage(id: PackageId, data: Doc): PackageDoc {
  return {
    id,
    name: String(data.name),
    priceIdr: Number(data.priceIdr),
    durationDays: Number(data.durationDays),
    active: data.active === true,
    sortOrder: Number(data.sortOrder),
    limits: data.limits as PackageLimits,
  };
}

async function loadPackages(tx: Tx): Promise<PackageDoc[]> {
  const packages: PackageDoc[] = [];
  for (const fallback of DEFAULT_PACKAGES) {
    const stored = await tx.get(`packages/${fallback.id}`);
    packages.push(normalizePackage(fallback.id, stored ?? fallback));
  }
  return packages.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function listActivePackages(env: Env) {
  return guarded(async () => env.store.runTransaction(async (tx) => ({ packages: (await loadPackages(tx)).filter((item) => item.active) })));
}

export function listAdminPackages(env: Env, actor: Actor) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    return { packages: await loadPackages(tx) };
  }));
}

/** Package edits affect future orders only; each order keeps its own packageSnapshot. */
export function savePackage(env: Env, actor: Actor, input: Record<string, unknown>) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const id = packageIds.find((item) => item === input.id);
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const priceIdr = input.priceIdr;
    const durationDays = input.durationDays;
    const active = input.active;
    const sortOrder = input.sortOrder;
    const limits = input.limits;
    if (!id) throw new ServiceError(400, 'invalid_package_id');
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new ServiceError(400, 'invalid_package_name');
    if (!Number.isInteger(priceIdr) || Number(priceIdr) < 1 || Number(priceIdr) > 100_000_000) throw new ServiceError(400, 'invalid_package_price');
    if (!Number.isInteger(durationDays) || Number(durationDays) < 1 || Number(durationDays) > 366) throw new ServiceError(400, 'invalid_package_duration');
    if (typeof active !== 'boolean') throw new ServiceError(400, 'invalid_package_status');
    if (!Number.isInteger(sortOrder) || Number(sortOrder) < 0 || Number(sortOrder) > 9999) throw new ServiceError(400, 'invalid_package_order');
    if (typeof limits !== 'object' || limits === null || Array.isArray(limits)) throw new ServiceError(400, 'invalid_package_limits');
    const raw = limits as Record<string, unknown>;
    const allowed = raw.allowedTemplateTiers;
    if (!Number.isInteger(raw.maxGifts) || Number(raw.maxGifts) < 1 || Number(raw.maxGifts) > 1000 ||
      !Number.isInteger(raw.maxPhotos) || Number(raw.maxPhotos) < 0 || Number(raw.maxPhotos) > 500 ||
      typeof raw.music !== 'boolean' || typeof raw.priorityReview !== 'boolean' ||
      !Array.isArray(allowed) || allowed.length === 0 || allowed.some((item) => item !== 'core' && item !== 'extended') || new Set(allowed).size !== allowed.length) {
      throw new ServiceError(400, 'invalid_package_limits');
    }
    const packageLimits: PackageLimits = { maxGifts: Number(raw.maxGifts), maxPhotos: Number(raw.maxPhotos), music: raw.music, priorityReview: raw.priorityReview, allowedTemplateTiers: [...allowed] as TemplateTier[] };
    const path = `packages/${id}`;
    const existing = await tx.get(path);
    const now = env.ts(env.nowMs());
    const value: PackageDoc = { id, name, priceIdr: Number(priceIdr), durationDays: Number(durationDays), active, sortOrder: Number(sortOrder), limits: packageLimits };
    tx.set(path, { ...value, createdAt: existing?.createdAt ?? now, updatedAt: now, updatedBy: actor.uid, schemaVersion: 1 });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: existing ? 'package.update' : 'package.create', actorUid: actor.uid, packageId: id, at: now });
    return { package: value };
  }));
}

function voucherFromRow(code: string, data: Doc): VoucherDoc {
  return {
    code,
    active: data.active === true,
    deleted: data.deleted === true,
    discount: data.discount as VoucherDiscount,
    startsAtMs: data.startsAtMs == null ? null : Number(data.startsAtMs),
    expiresAtMs: data.expiresAtMs == null ? null : Number(data.expiresAtMs),
    maxUses: data.maxUses == null ? null : Number(data.maxUses),
    usedCount: Number(data.usedCount ?? 0),
    minimumAmountIdr: Number(data.minimumAmountIdr),
  };
}

export function listAdminVouchers(env: Env, actor: Actor) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const rows = await tx.query('vouchers');
    const vouchers = rows.map((row) => voucherFromRow(row.id, row.data)).sort((a, b) => a.code.localeCompare(b.code));
    return { vouchers };
  }));
}

/** Create/update voucher definitions. usage counters are server-owned and cannot be reset by admin edits. */
export function saveVoucher(env: Env, actor: Actor, input: Record<string, unknown>) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const rawCode = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
    const code = normalizeVoucherCode(rawCode);
    if (!code || code !== rawCode) throw new ServiceError(400, 'invalid_code');
    if (typeof input.discount !== 'object' || input.discount === null || Array.isArray(input.discount)) throw new ServiceError(400, 'invalid_discount_kind');
    const rawDiscount = input.discount as Record<string, unknown>;
    let discount: VoucherDiscount;
    if (rawDiscount.kind === 'percent' && typeof rawDiscount.value === 'number') discount = { kind: 'percent', value: rawDiscount.value };
    else if (rawDiscount.kind === 'fixed' && typeof rawDiscount.valueIdr === 'number') discount = { kind: 'fixed', valueIdr: rawDiscount.valueIdr };
    else throw new ServiceError(400, 'invalid_discount_kind');
    const startsAtMs = input.startsAtMs === null || input.startsAtMs === '' || input.startsAtMs === undefined ? null : input.startsAtMs;
    const expiresAtMs = input.expiresAtMs === null || input.expiresAtMs === '' || input.expiresAtMs === undefined ? null : input.expiresAtMs;
    const maxUses = input.maxUses === null || input.maxUses === '' || input.maxUses === undefined ? null : input.maxUses;
    if (startsAtMs !== null && (typeof startsAtMs !== 'number' || !Number.isSafeInteger(startsAtMs))) throw new ServiceError(400, 'invalid_start_date');
    if (expiresAtMs !== null && (typeof expiresAtMs !== 'number' || !Number.isSafeInteger(expiresAtMs))) throw new ServiceError(400, 'invalid_expiry_date');
    if (maxUses !== null && (typeof maxUses !== 'number' || !Number.isInteger(maxUses))) throw new ServiceError(400, 'invalid_max_uses');
    if (typeof input.minimumAmountIdr !== 'number' || !Number.isInteger(input.minimumAmountIdr)) throw new ServiceError(400, 'invalid_minimum');
    if (typeof input.active !== 'boolean') throw new ServiceError(400, 'invalid_status');

    const path = `vouchers/${code}`;
    const existing = await tx.get(path);
    const usedCount = existing ? Number(existing.usedCount ?? 0) : 0;
    const voucher: VoucherDoc = {
      code, active: input.active, deleted: false, discount,
      startsAtMs: startsAtMs as number | null, expiresAtMs: expiresAtMs as number | null,
      maxUses: maxUses as number | null, usedCount, minimumAmountIdr: input.minimumAmountIdr,
    };
    const errors = validateVoucherDefinition(voucher);
    if (errors.length) throw new ServiceError(400, errors[0]);
    if (voucher.maxUses !== null && voucher.maxUses < usedCount) throw new ServiceError(400, 'voucher_max_uses_below_used_count');
    const now = env.ts(env.nowMs());
    tx.set(path, { ...voucher, deletedAt: null, createdAt: existing?.createdAt ?? now, updatedAt: now, updatedBy: actor.uid, schemaVersion: 1 });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: existing ? 'voucher.update' : 'voucher.create', actorUid: actor.uid, voucherCode: code, at: now });
    return { voucher };
  }));
}

/** Soft-delete keeps order references/history while immediately disabling redemption. */
export function deleteVoucher(env: Env, actor: Actor, rawCode: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const raw = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const code = normalizeVoucherCode(raw);
    if (code !== raw || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw new ServiceError(400, 'invalid_code');
    const path = `vouchers/${code}`;
    const existing = await tx.get(path);
    if (!existing) throw new ServiceError(404, 'voucher_not_found');
    const now = env.ts(env.nowMs());
    tx.set(path, { ...existing, active: false, deleted: true, deletedAt: now, updatedAt: now, updatedBy: actor.uid });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'voucher.delete', actorUid: actor.uid, voucherCode: code, at: now });
    return { code, deleted: true };
  }));
}

export type AdminOrderRow = {
  orderId: string; createdAtMs: number; customerEmail: string | null; customerWhatsapp: string | null;
  giftId: string | null; templateId: string | null; packageId: string; packageName: string; originalAmountIdr: number; discountIdr: number;
  amountIdr: number; paymentMethodId: string; voucherCode: string | null; status: string; publicationStatus: string; publicSlug: string | null;
};

export function listAdminOrders(env: Env, actor: Actor, filters: { status?: unknown; packageId?: unknown; search?: unknown } = {}) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const statuses = ['awaiting_payment', 'proof_submitted', 'approved', 'rejected', 'cancelled'];
    const rows = (await Promise.all(statuses.map((status) => tx.query('orders', 'status', status)))).flat();
    const status = typeof filters.status === 'string' && statuses.includes(filters.status) ? filters.status : null;
    const packageId = typeof filters.packageId === 'string' ? filters.packageId : null;
    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase().slice(0, 100) : '';
    const orders: AdminOrderRow[] = [];
    for (const row of rows) {
      const data = row.data;
      const haystack = `${row.id} ${data.customerEmail ?? ''} ${data.customerWhatsapp ?? ''}`.toLowerCase();
      if (data.deletedAt) continue;
      if (status && data.status !== status) continue;
      if (packageId && data.packageId !== packageId) continue;
      if (search && !haystack.includes(search)) continue;
      const gift = typeof data.giftId === 'string' ? await tx.get(`gifts/${data.giftId}`) : null;
      orders.push({
        orderId: row.id, createdAtMs: millis(data.createdAt, env.nowMs()), customerEmail: data.customerEmail ?? null, customerWhatsapp: data.customerWhatsapp ?? null,
        giftId: data.giftId ?? null, templateId: gift?.templateId ?? null, packageId: String(data.packageId), packageName: String(data.packageSnapshot?.name ?? data.packageId),
        originalAmountIdr: Number(data.originalAmountIdr ?? data.packageSnapshot?.priceIdr ?? data.amountIdr ?? 0), discountIdr: Number(data.discountIdr ?? 0), amountIdr: Number(data.amountIdr ?? 0),
        paymentMethodId: String(data.paymentMethodId ?? ''), voucherCode: data.voucherCode ?? null, status: String(data.status), publicationStatus: gift?.status === 'published' ? 'published' : 'not_published', publicSlug: gift?.slug ?? null,
      });
    }
    orders.sort((a, b) => b.createdAtMs - a.createdAtMs);
    const allApproved = rows.filter((row) => row.data.status === 'approved');
    const paid = orders.filter((order) => order.status === 'approved');
    return { orders, summary: { count: orders.length, successful: paid.length, pending: orders.filter((order) => order.status === 'awaiting_payment' || order.status === 'proof_submitted').length, revenueIdr: allApproved.reduce((sum, row) => sum + Number(row.data.amountIdr ?? 0), 0) } };
  }));
}

export function getAdminOverview(env: Env, actor: Actor) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    const statuses = ['awaiting_payment', 'proof_submitted', 'approved', 'rejected', 'cancelled'];
    const orders = (await Promise.all(statuses.map((status) => tx.query('orders', 'status', status)))).flat()
      .sort((a, b) => millis(b.data.createdAt, env.nowMs()) - millis(a.data.createdAt, env.nowMs()));
    const gifts = await tx.query('gifts');
    const visibleOrders = orders.filter((row) => !row.data.deletedAt);
    const approved = orders.filter((row) => row.data.status === 'approved');
    return {
      summary: {
        transactions: visibleOrders.length,
        revenueIdr: approved.reduce((sum, row) => sum + Number(row.data.amountIdr ?? 0), 0),
        pending: visibleOrders.filter((row) => row.data.status === 'awaiting_payment' || row.data.status === 'proof_submitted').length,
        approved: visibleOrders.filter((row) => row.data.status === 'approved').length,
        publishedGifts: gifts.filter((row) => row.data.status === 'published').length,
      },
      recentOrders: orders.filter((row) => !row.data.deletedAt).slice(0, 6).map((row) => ({ orderId: row.id, createdAtMs: millis(row.data.createdAt, env.nowMs()), amountIdr: Number(row.data.amountIdr ?? 0), packageName: String(row.data.packageSnapshot?.name ?? row.data.packageId ?? ''), status: String(row.data.status ?? '') })),
    };
  }));
}
function hasPaymentProofMetadata(order: Doc): boolean {
  const proof = order.proof;
  return typeof proof?.storagePath === 'string' && proof.storagePath.trim().length > 0 &&
    typeof proof.contentType === 'string' && proof.contentType.length > 0 && Number.isInteger(proof.sizeBytes) && proof.sizeBytes > 0 &&
    typeof proof.submittedAt?.toMillis === 'function';
}

function hasStoredPaymentProof(order: Doc): boolean {
  return order.status === 'proof_submitted' && hasPaymentProofMetadata(order);
}

/** Admin-only detail; raw storage paths are never returned, only proof metadata. */
export function getAdminOrderDetail(env: Env, actor: Actor, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(orderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${orderId}`);
    if (!order) throw new ServiceError(404, 'order_not_found');
    const gift = typeof order.giftId === 'string' ? await tx.get(`gifts/${order.giftId}`) : null;
    const auditRows = await tx.query('adminAuditLogs', 'orderId', orderId);
    const audit = auditRows.map(({ id, data }) => ({
      id, action: String(data.action ?? ''), actorUid: String(data.actorUid ?? ''),
      atMs: millis(data.at, env.nowMs()), reason: typeof data.reason === 'string' ? data.reason : null,
    })).sort((a, b) => a.atMs - b.atMs);
    const hasProof = hasPaymentProofMetadata(order);
    const proof = hasProof ? {
      available: true as const,
      contentType: String(order.proof.contentType),
      sizeBytes: Number(order.proof.sizeBytes),
      submittedAtMs: millis(order.proof.submittedAt, env.nowMs()),
    } : null;
    return { order: {
      orderId, customerEmail: order.customerEmail ?? null, customerWhatsapp: order.customerWhatsapp ?? null,
      packageId: String(order.packageId), packageSnapshot: order.packageSnapshot ?? null,
      originalAmountIdr: Number(order.originalAmountIdr ?? order.packageSnapshot?.priceIdr ?? order.amountIdr ?? 0),
      discountIdr: Number(order.discountIdr ?? 0), amountIdr: Number(order.amountIdr ?? 0), voucherCode: order.voucherCode ?? null,
      paymentMethodId: String(order.paymentMethodId ?? ''), paymentMethodSnapshot: order.paymentMethodSnapshot ?? null,
      status: String(order.status), deletedAtMs: order.deletedAt ? millis(order.deletedAt, env.nowMs()) : null, proof, proofAiVerification: order.proofAiVerification ?? null, rejectionReason: order.rejectionReason ?? null,
      reviewedBy: order.reviewedBy ?? null, reviewedAtMs: order.reviewedAt ? millis(order.reviewedAt, env.nowMs()) : null,
      subscriptionId: order.subscriptionId ?? null, createdAtMs: millis(order.createdAt, env.nowMs()), updatedAtMs: millis(order.updatedAt, env.nowMs()),
      giftId: typeof order.giftId === 'string' ? order.giftId : null, templateId: gift?.templateId ?? null,
      publicSlug: gift?.slug ?? null, publicationStatus: gift?.status === 'published' ? 'published' : 'not_published',
      canReview: hasStoredPaymentProof(order),
    }, audit };
  }));
}

/** Issues a separate 30-day customer editor link; existing guest links are not rotated or revoked. */
export function createAdminCustomerEditorLink(env: Env, actor: Actor, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(orderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${orderId}`);
    if (!order || order.deletedAt) throw new ServiceError(404, 'order_not_found');
    const giftId = typeof order.giftId === 'string' ? order.giftId : '';
    if (!giftId) throw new ServiceError(409, 'gift_not_linked');
    const gift = await tx.get(`gifts/${giftId}`);
    if (!gift || gift.status === 'deleted' || gift.ownerUid !== order.userId) throw new ServiceError(404, 'order_not_found');

    const token = createEditToken();
    const nowMs = env.nowMs();
    const expiresAtMs = nowMs + 30 * 24 * 60 * 60 * 1000;
    const createdAt = env.ts(nowMs);
    tx.create(`guestEditLinks/${hashEditToken(token)}`, {
      giftId, ownerUid: gift.ownerUid, orderId, issuedByAdminUid: actor.uid,
      createdAt, expiresAt: env.ts(expiresAtMs), revokedAt: null, schemaVersion: 1,
    });
    tx.create(`adminAuditLogs/${env.newId()}`, {
      action: 'order.customer_editor_link_issued', actorUid: actor.uid, orderId, at: createdAt,
    });
    return { editorUrl: siteUrl(`/editor/link/${encodeURIComponent(token)}`), expiresAtMs };
  }));
}

/** Permanently removes an order and its private/public gift links. Paid entitlements and antifraud hashes are retained. */
export function deleteAdminOrder(env: Env, actor: Actor, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(orderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${orderId}`);
    if (!order) throw new ServiceError(404, 'order_not_found');
    const giftId = typeof order.giftId === 'string' ? order.giftId : null;
    const gift = giftId ? await tx.get(`gifts/${giftId}`) : null;
    const giftOrders = giftId ? await tx.query('orders', 'giftId', giftId) : [];
    const deleteGift = !!gift && !giftOrders.some((row) => row.id !== orderId);
    const [editorLinks, orderIdempotency, transactionClaims, proofClaims, audits] = await Promise.all([
      tx.query('guestEditLinks', 'orderId', orderId),
      tx.query('guestOrderIdempotency', 'orderId', orderId),
      tx.query('paymentTransactionClaims', 'orderId', orderId),
      tx.query('paymentProofClaims', 'orderId', orderId),
      tx.query('adminAuditLogs', 'orderId', orderId),
    ]);
    const [giftLinks, giftIdempotency, recoveries, media, revisions, publicGift, analytics, subscription] = deleteGift && gift && giftId
      ? await Promise.all([
        tx.query('guestEditLinks', 'giftId', giftId),
        tx.query('guestOrderIdempotency', 'giftId', giftId),
        tx.query('guestEditRecoveries', 'giftId', giftId),
        tx.query('giftMedia', 'giftId', giftId),
        tx.query('giftRevisions', 'giftId', giftId),
        tx.get(`publicGifts/${gift.slug}`),
        tx.get(`giftAnalytics/${gift.slug}`),
        typeof order.subscriptionId === 'string' ? tx.get(`subscriptions/${order.subscriptionId}`) : Promise.resolve(null),
      ])
      : [[], [], [], [], [], null, null, null] as const;
    const now = env.ts(env.nowMs());

    // Keep paid time-limited access and duplicate-payment protections, but remove their order PII link.
    if (subscription?.orderId === orderId) tx.update(`subscriptions/${order.subscriptionId}`, { orderId: null, updatedAt: now });
    for (const row of transactionClaims) tx.update(`paymentTransactionClaims/${row.id}`, { orderId: null });
    for (const row of proofClaims) tx.update(`paymentProofClaims/${row.id}`, { orderId: null });

    const linksToDelete = new Map([...editorLinks, ...giftLinks].map((row) => [row.id, row]));
    for (const row of linksToDelete.values()) tx.delete(`guestEditLinks/${row.id}`);
    const idempotencyToDelete = new Map([...orderIdempotency, ...giftIdempotency].map((row) => [row.id, row]));
    for (const row of idempotencyToDelete.values()) tx.delete(`guestOrderIdempotency/${row.id}`);
    if (deleteGift && gift && giftId) {
      for (const row of recoveries) tx.delete(`guestEditRecoveries/${row.id}`);
      for (const row of media) tx.delete(`giftMedia/${row.id}`);
      for (const row of revisions) {
        const revision = Number(row.data.number);
        if (Number.isSafeInteger(revision) && revision > 0) tx.delete(`gifts/${giftId}/revisions/${revision}`);
      }
      tx.set(`slugs/${gift.slug}`, { giftId: null, ownerUid: null, orderId: null, expiresAt: null, createdAt: gift.createdAt ?? now });
      if (publicGift) tx.delete(`publicGifts/${gift.slug}`);
      if (analytics) tx.delete(`giftAnalytics/${gift.slug}`);
    }

    // Keep the audit trail but scrub order-linked details and direct references.
    for (const row of audits) tx.set(`adminAuditLogs/${row.id}`, {
      action: row.data.action, actorUid: row.data.actorUid, orderId: null, reason: null,
      ...(row.data.at === undefined ? {} : { at: row.data.at }),
    });
    tx.delete(`orders/${orderId}`);
    if (deleteGift && giftId) tx.delete(`gifts/${giftId}`);
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.permanently_deleted', actorUid: actor.uid, giftDeleted: deleteGift, at: now });
    const mediaPaths = media.map((row) => row.data.storagePath).filter((path): path is string => typeof path === 'string' && !!giftId && path.startsWith(`private/${giftId}/`));
    const proofPath = typeof order.proof?.storagePath === 'string' && typeof order.userId === 'string'
      && order.proof.storagePath.startsWith(`paymentProofs/${order.userId}/${orderId}/`) ? order.proof.storagePath : null;
    return { giftDeleted: deleteGift, mediaPaths, proofPath };
  }));
}

/** Returns a proof path only to the server-side Storage preview route. */
export function getAdminPaymentProofPath(env: Env, actor: Actor, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    requireAdmin(actor);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(orderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${orderId}`);
    if (!order) throw new ServiceError(404, 'order_not_found');
    if (!hasPaymentProofMetadata(order)) throw new ServiceError(404, 'proof_not_found');
    return { storagePath: String(order.proof.storagePath), contentType: String(order.proof.contentType) };
  }));
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
    if (!hasStoredPaymentProof(order)) throw new ServiceError(409, order.status === 'proof_submitted' ? 'proof_required' : 'order_not_reviewable');
    const userId = typeof order.userId === 'string' ? order.userId : '';
    if (!userId) throw new ServiceError(409, 'order_owner_missing');
    const nowMs = env.nowMs();
    const schedulePath = `subscriptionSchedules/${encodeURIComponent(userId)}`;
    // Reading and updating one deterministic ledger serializes simultaneous approvals for the same owner.
    const [schedule, subscriptionRows] = await Promise.all([
      tx.get(schedulePath), tx.query('subscriptions', 'userId', userId),
    ]);
    const associatedGiftId = typeof order.giftId === 'string' ? order.giftId : null;
    const associatedGift = associatedGiftId ? await tx.get(`gifts/${associatedGiftId}`) : null;
    if (associatedGiftId && !associatedGift) throw new ServiceError(409, 'order_gift_not_found');
    if (associatedGift && associatedGift.ownerUid !== userId) throw new ServiceError(409, 'order_gift_mismatch');
    const furthestActiveExpiryMs = subscriptionRows.reduce((latest, row) => {
      if (row.data.userId !== userId || row.data.status !== 'active') return latest;
      const expiresAtMs = millis(row.data.expiresAt, nowMs);
      return expiresAtMs > nowMs ? Math.max(latest, expiresAtMs) : latest;
    }, nowMs);
    const plan = planSubscriptionActivation({ status: order.status, packageSnapshot: order.packageSnapshot }, nowMs, furthestActiveExpiryMs);
    if (!plan.ok) throw new ServiceError(409, plan.reason);

    const now = env.ts(nowMs);
    const subscriptionId = `sub_${orderId}`;
    tx.create(`subscriptions/${subscriptionId}`, {
      userId, packageId: order.packageId, orderId, status: 'active',
      startedAt: env.ts(plan.startedAtMs), expiresAt: env.ts(plan.expiresAtMs), packageSnapshot: plan.packageSnapshot,
      createdAt: now, updatedAt: now, schemaVersion: 2,
    });
    if (associatedGift && associatedGift.status !== 'deleted' && associatedGift.publishedRevision == null) {
      tx.update(`gifts/${associatedGiftId}`, { createdUnderSubscriptionId: subscriptionId, updatedAt: now });
    }
    const scheduleUpdate = { userId, lastSubscriptionId: subscriptionId, lastStartedAt: env.ts(plan.startedAtMs), lastExpiresAt: env.ts(plan.expiresAtMs), updatedAt: now, schemaVersion: 2 as const };
    if (schedule) tx.update(schedulePath, scheduleUpdate);
    else tx.create(schedulePath, scheduleUpdate);
    tx.update(`orders/${orderId}`, { status: 'approved', reviewedBy: actor.uid, reviewedAt: now, subscriptionId, updatedAt: now });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.approve', actorUid: actor.uid, orderId, subscriptionId, startedAtMs: plan.startedAtMs, expiresAtMs: plan.expiresAtMs, at: now });
    return { subscriptionId, startedAtMs: plan.startedAtMs, expiresAtMs: plan.expiresAtMs };
  }));
}

/**
 * High-confidence machine gate for guest proof uploads. Any missing/uncertain
 * field remains in manual review. Admin approval remains available for all
 * orders; this path never trusts model-supplied comparison flags or a raw ID.
 */
export function autoApproveGuestPaymentProof(env: Env, orderId: string) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(orderId)) throw new ServiceError(404, 'order_not_found');
    const order = await tx.get(`orders/${orderId}`);
    if (!order || order.status !== 'proof_submitted' || !hasStoredPaymentProof(order)) return { status: 'manual_review' as const, reason: 'order_not_reviewable' };
    const ai = order.proofAiVerification as Record<string, unknown> | null;
    const method = order.paymentMethodSnapshot as Record<string, unknown> | null;
    const expectedAccount = typeof method?.accountNumber === 'string' && method.accountNumber.trim().length > 0;
    const transactionId = typeof ai?.transactionId === 'string' ? ai.transactionId.trim() : '';
    const paymentDate = typeof ai?.paymentDate === 'string' ? ai.paymentDate.trim() : '';
    const recipient = typeof ai?.recipient === 'string' ? ai.recipient.trim() : '';
    const normalizedReference = transactionId.normalize('NFKC').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const expectedRecipient = String(method?.accountHolder || method?.providerName || method?.name || '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const actualRecipient = recipient.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const expectedAccountDigits = typeof method?.accountNumber === 'string' ? method.accountNumber.replace(/\D/g, '') : '';
    const actualAccountDigits = typeof ai?.accountNumber === 'string' ? ai.accountNumber.replace(/\D/g, '') : '';
    const eligible = ai?.state === 'analyzed'
      && typeof ai.confidence === 'number' && ai.confidence >= 0.98
      && typeof ai.amountIdr === 'number' && ai.amountIdr === Number(order.amountIdr)
      && Boolean(expectedRecipient && actualRecipient && actualRecipient === expectedRecipient)
      && (!expectedAccount || Boolean(expectedAccountDigits && actualAccountDigits && actualAccountDigits === expectedAccountDigits))
      && Boolean(normalizedReference.length >= 4 && paymentDate && recipient);
    if (!eligible) {
      if (ai) tx.update(`orders/${orderId}`, { proofAiVerification: { ...ai, autoApproval: 'manual_review' } });
      return { status: 'manual_review' as const, reason: 'criteria_not_met' };
    }

    const transactionHash = createHash('sha256').update(normalizedReference).digest('hex');
    const claimed = await tx.get(`paymentTransactionClaims/${transactionHash}`);
    if (claimed && claimed.orderId !== orderId) {
      tx.update(`orders/${orderId}`, { proofAiVerification: { ...ai, autoApproval: 'manual_review' } });
      tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.payment_reference_duplicate', actorUid: 'system:gemini-proof-review', orderId, transactionHash, at: env.ts(env.nowMs()) });
      return { status: 'manual_review' as const, reason: 'duplicate_transaction' };
    }

    const userId = typeof order.userId === 'string' ? order.userId : '';
    if (!userId) throw new ServiceError(409, 'order_owner_missing');
    const nowMs = env.nowMs();
    const schedulePath = `subscriptionSchedules/${encodeURIComponent(userId)}`;
    const [schedule, subscriptionRows] = await Promise.all([
      tx.get(schedulePath), tx.query('subscriptions', 'userId', userId),
    ]);
    const associatedGiftId = typeof order.giftId === 'string' ? order.giftId : null;
    const associatedGift = associatedGiftId ? await tx.get(`gifts/${associatedGiftId}`) : null;
    if (associatedGiftId && !associatedGift) throw new ServiceError(409, 'order_gift_not_found');
    if (associatedGift && associatedGift.ownerUid !== userId) throw new ServiceError(409, 'order_gift_mismatch');
    const furthestActiveExpiryMs = subscriptionRows.reduce((latest, row) => {
      if (row.data.userId !== userId || row.data.status !== 'active') return latest;
      const expiresAtMs = millis(row.data.expiresAt, nowMs);
      return expiresAtMs > nowMs ? Math.max(latest, expiresAtMs) : latest;
    }, nowMs);
    const plan = planSubscriptionActivation({ status: order.status, packageSnapshot: order.packageSnapshot }, nowMs, furthestActiveExpiryMs);
    if (!plan.ok) return { status: 'manual_review' as const, reason: plan.reason };

    const now = env.ts(nowMs);
    if (!claimed) tx.create(`paymentTransactionClaims/${transactionHash}`, { orderId, createdAt: now });
    const subscriptionId = `sub_${orderId}`;
    tx.create(`subscriptions/${subscriptionId}`, {
      userId, packageId: order.packageId, orderId, status: 'active',
      startedAt: env.ts(plan.startedAtMs), expiresAt: env.ts(plan.expiresAtMs), packageSnapshot: plan.packageSnapshot,
      createdAt: now, updatedAt: now, schemaVersion: 2,
    });
    if (associatedGift && associatedGift.status !== 'deleted' && associatedGift.publishedRevision == null) {
      tx.update(`gifts/${associatedGiftId}`, { createdUnderSubscriptionId: subscriptionId, updatedAt: now });
    }
    const scheduleUpdate = { userId, lastSubscriptionId: subscriptionId, lastStartedAt: env.ts(plan.startedAtMs), lastExpiresAt: env.ts(plan.expiresAtMs), updatedAt: now, schemaVersion: 2 as const };
    if (schedule) tx.update(schedulePath, scheduleUpdate);
    else tx.create(schedulePath, scheduleUpdate);
    tx.update(`orders/${orderId}`, {
      status: 'approved', reviewedBy: 'system:gemini-proof-review', reviewedAt: now,
      subscriptionId, proofAiVerification: { ...ai, autoApproval: 'approved' }, updatedAt: now,
    });
    tx.create(`adminAuditLogs/${env.newId()}`, {
      action: 'order.auto_approve_gemini', actorUid: 'system:gemini-proof-review', orderId, subscriptionId,
      transactionHash, confidence: ai.confidence, amountIdr: ai.amountIdr, recipient: ai.recipient,
      startedAtMs: plan.startedAtMs, expiresAtMs: plan.expiresAtMs, at: now,
    });
    return { status: 'approved' as const, subscriptionId, startedAtMs: plan.startedAtMs, expiresAtMs: plan.expiresAtMs };
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
    if (!hasStoredPaymentProof(order)) throw new ServiceError(409, 'proof_required');
    const now = env.ts(env.nowMs());
    tx.update(`orders/${orderId}`, { status: 'rejected', reviewedBy: actor.uid, reviewedAt: now, rejectionReason: text, updatedAt: now });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'order.reject', actorUid: actor.uid, orderId, reason: text, at: now });
    return { status: 'rejected' };
  }));
}
