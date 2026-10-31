import type {
  GiftStatus, OrderStatus, PackageSnapshot, PackageLimits, PublicGiftStatus,
  SubscriptionStatus, TemplateTier,
} from './model/types.ts';
import { MEDIA_UPLOAD_ENABLED } from './features.ts';

/**
 * Pure entitlement rules. No I/O, no clock access: callers pass `nowMs` taken
 * from the SERVER clock, never from the client. Route handlers load the data
 * with the Admin SDK and call these functions.
 *
 * MODEL B: subscriptions gate creating, editing and publishing. They never
 * gate public viewing of an already-published gift, and owners can always take
 * their own gifts down.
 */

export const DAY_MS = 86_400_000;

export type SubLike = {
  status: SubscriptionStatus;
  startedAt: { toMillis(): number };
  expiresAt: { toMillis(): number };
  packageSnapshot: PackageSnapshot;
};

export type EntitlementState = 'active' | 'expired' | 'none';

export interface Entitlement<S extends SubLike = SubLike> {
  state: EntitlementState;
  /** The subscription currently granting access (state === 'active'). */
  current: S | null;
  limits: PackageLimits | null;
  expiresAtMs: number | null;
  remainingMs: number;
  /** When the most recent lapsed subscription ended (state === 'expired'). */
  lastExpiredAtMs: number | null;
}

export function isSubscriptionActive(sub: SubLike, nowMs: number): boolean {
  return sub.status === 'active' && sub.startedAt.toMillis() <= nowMs && nowMs < sub.expiresAt.toMillis();
}

/**
 * Resolve what a user may currently do. Revoked subscriptions are ignored.
 * If several are active at once, the one that lasts longest wins; ties go to
 * the higher-priced package. Subscriptions do not stack: a new one starts at
 * approval time.
 */
export function resolveEntitlement<S extends SubLike>(subs: readonly S[], nowMs: number): Entitlement<S> {
  const usable = subs.filter((s) => s.status === 'active');
  const active = usable.filter((s) => isSubscriptionActive(s, nowMs));
  if (active.length) {
    const best = [...active].sort((a, b) =>
      b.expiresAt.toMillis() - a.expiresAt.toMillis() ||
      b.packageSnapshot.priceIdr - a.packageSnapshot.priceIdr)[0];
    return {
      state: 'active', current: best, limits: best.packageSnapshot.limits,
      expiresAtMs: best.expiresAt.toMillis(), remainingMs: best.expiresAt.toMillis() - nowMs,
      lastExpiredAtMs: null,
    };
  }
  const lapsed = usable.filter((s) => s.expiresAt.toMillis() <= nowMs);
  if (lapsed.length) {
    return {
      state: 'expired', current: null, limits: null, expiresAtMs: null, remainingMs: 0,
      lastExpiredAtMs: Math.max(...lapsed.map((s) => s.expiresAt.toMillis())),
    };
  }
  return { state: 'none', current: null, limits: null, expiresAtMs: null, remainingMs: 0, lastExpiredAtMs: null };
}

export type DenialReason =
  | 'no_subscription'
  | 'subscription_expired'
  | 'quota_reached'
  | 'template_not_in_package'
  | 'not_owner'
  | 'gift_deleted'
  | 'gift_archived'
  | 'gift_not_archived'
  | 'media_unavailable'
  | 'media_not_in_package'
  | 'photo_limit_reached';

export type Decision = { allowed: true } | { allowed: false; reason: DenialReason };
const ok: Decision = { allowed: true };
const deny = (reason: DenialReason): Decision => ({ allowed: false, reason });

function requireActive(ent: Entitlement): Decision {
  if (ent.state === 'active') return ok;
  return deny(ent.state === 'expired' ? 'subscription_expired' : 'no_subscription');
}

/** Gift quota is counted per subscription via `createdUnderSubscriptionId`. */
export function canCreateGift(
  ent: Entitlement,
  ctx: { giftsCreatedUnderCurrent: number; templateTier: TemplateTier },
): Decision {
  const active = requireActive(ent);
  if (!active.allowed) return active;
  const limits = ent.limits!;
  if (!limits.allowedTemplateTiers.includes(ctx.templateTier)) return deny('template_not_in_package');
  if (ctx.giftsCreatedUnderCurrent >= limits.maxGifts) return deny('quota_reached');
  return ok;
}

export type GiftRef = { ownerUid: string; status: GiftStatus };

/** Editing the draft of an owned gift (published gifts remain editable as drafts). */
export function canEditGift(ent: Entitlement, gift: GiftRef, uid: string): Decision {
  if (gift.ownerUid !== uid) return deny('not_owner');
  if (gift.status === 'deleted') return deny('gift_deleted');
  if (gift.status === 'archived') return deny('gift_archived');
  return requireActive(ent);
}

/** Publishing a new gift or updating an existing publication. Same gate as editing. */
export function canPublishGift(ent: Entitlement, gift: GiftRef, uid: string): Decision {
  return canEditGift(ent, gift, uid);
}

/** Making an archived gift public again is a publication act, so it needs an active package. */
export function canUnarchiveGift(ent: Entitlement, gift: GiftRef, uid: string): Decision {
  if (gift.ownerUid !== uid) return deny('not_owner');
  if (gift.status !== 'archived') return deny('gift_not_archived');
  return requireActive(ent);
}

/**
 * Taking your own gift down is never blocked by billing. Privacy control must
 * not depend on an active package.
 */
export function canArchiveOrDeleteGift(gift: GiftRef, uid: string): Decision {
  if (gift.ownerUid !== uid) return deny('not_owner');
  if (gift.status === 'deleted') return deny('gift_deleted');
  return ok;
}

export function canAddPhoto(
  ent: Entitlement, currentPhotoCount: number, mediaEnabled: boolean = MEDIA_UPLOAD_ENABLED,
): Decision {
  if (!mediaEnabled) return deny('media_unavailable');
  const active = requireActive(ent);
  if (!active.allowed) return active;
  return currentPhotoCount < ent.limits!.maxPhotos ? ok : deny('photo_limit_reached');
}

export function canAddAudio(ent: Entitlement, mediaEnabled: boolean = MEDIA_UPLOAD_ENABLED): Decision {
  if (!mediaEnabled) return deny('media_unavailable');
  const active = requireActive(ent);
  if (!active.allowed) return active;
  return ent.limits!.music ? ok : deny('media_not_in_package');
}

/**
 * Public visibility. Takes ONLY the public document's status; it cannot see
 * subscriptions, orders or owners, so it cannot be broken by expiry. This
 * is the Model B guarantee in code.
 */
export function isPublicGiftVisible(pub: { status: PublicGiftStatus }): boolean {
  return pub.status === 'published';
}

/* ---------- Orders and subscription activation ---------- */

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ['proof_submitted', 'cancelled'],
  proof_submitted: ['approved', 'rejected', 'cancelled'],
  rejected: ['proof_submitted', 'cancelled'],
  approved: [],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export type ActivationPlan =
  | { ok: true; startedAtMs: number; expiresAtMs: number; packageSnapshot: PackageSnapshot }
  | { ok: false; reason: 'order_not_reviewable' | 'invalid_duration' };

/**
 * Plan the subscription created when an admin approves an order. The period
 * starts at approval time (server clock) and uses the duration frozen in the
 * order's snapshot. Only a `proof_submitted` order can be approved, so
 * uploading a screenshot alone never activates anything.
 */
export function planSubscriptionActivation(
  order: { status: OrderStatus; packageSnapshot: PackageSnapshot }, approvedAtMs: number,
): ActivationPlan {
  if (!canTransitionOrder(order.status, 'approved')) return { ok: false, reason: 'order_not_reviewable' };
  const days = order.packageSnapshot.durationDays;
  if (!Number.isInteger(days) || days < 1 || days > 366) return { ok: false, reason: 'invalid_duration' };
  return { ok: true, startedAtMs: approvedAtMs, expiresAtMs: approvedAtMs + days * DAY_MS, packageSnapshot: order.packageSnapshot };
}
