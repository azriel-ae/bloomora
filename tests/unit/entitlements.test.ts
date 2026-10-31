import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS, resolveEntitlement, canCreateGift, canEditGift, canPublishGift, canUnarchiveGift,
  canArchiveOrDeleteGift, canAddPhoto, canAddAudio, isPublicGiftVisible, canTransitionOrder,
  planSubscriptionActivation, type SubLike,
} from '../../lib/entitlements.ts';
import { DEFAULT_PACKAGES } from '../../lib/packages.ts';
import { MEDIA_UPLOAD_ENABLED } from '../../lib/features.ts';

const ts = (ms: number) => ({ toMillis: () => ms });
const snap = (id: 'basic' | 'plus' | 'premium') => {
  const p = DEFAULT_PACKAGES.find((x) => x.id === id)!;
  return { packageId: p.id, name: p.name, priceIdr: p.priceIdr, durationDays: p.durationDays, limits: p.limits };
};
const sub = (id: 'basic' | 'plus' | 'premium', startMs: number, days?: number, status: 'active' | 'revoked' = 'active'): SubLike => ({
  status, startedAt: ts(startMs), expiresAt: ts(startMs + (days ?? snap(id).durationDays) * DAY_MS), packageSnapshot: snap(id),
});
const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);

test('seed packages match the existing pricing page', () => {
  assert.deepEqual(DEFAULT_PACKAGES.map((p) => [p.id, p.priceIdr, p.durationDays]),
    [['basic', 19000, 3], ['plus', 39000, 14], ['premium', 69000, 30]]);
});

test('no subscription: cannot create or edit', () => {
  const ent = resolveEntitlement([], T0);
  assert.equal(ent.state, 'none');
  assert.deepEqual(canCreateGift(ent, { giftsCreatedUnderCurrent: 0, templateTier: 'core' }), { allowed: false, reason: 'no_subscription' });
});

test('expiry boundary is exclusive and uses the supplied server clock', () => {
  const s = sub('basic', T0);
  const end = T0 + 3 * DAY_MS;
  assert.equal(resolveEntitlement([s], end - 1).state, 'active');
  assert.equal(resolveEntitlement([s], end).state, 'expired');
  assert.equal(resolveEntitlement([s], T0 - 1).state, 'none');
});

test('quota and template tier are enforced per package', () => {
  const basic = resolveEntitlement([sub('basic', T0)], T0 + 1000);
  assert.deepEqual(canCreateGift(basic, { giftsCreatedUnderCurrent: 0, templateTier: 'core' }), { allowed: true });
  assert.deepEqual(canCreateGift(basic, { giftsCreatedUnderCurrent: 1, templateTier: 'core' }), { allowed: false, reason: 'quota_reached' });
  assert.deepEqual(canCreateGift(basic, { giftsCreatedUnderCurrent: 0, templateTier: 'extended' }), { allowed: false, reason: 'template_not_in_package' });
  const plus = resolveEntitlement([sub('plus', T0)], T0 + 1000);
  assert.deepEqual(canCreateGift(plus, { giftsCreatedUnderCurrent: 0, templateTier: 'extended' }), { allowed: true });
});

test('ownership is always enforced', () => {
  const ent = resolveEntitlement([sub('premium', T0)], T0 + 1000);
  const gift = { ownerUid: 'alice', status: 'draft' as const };
  assert.deepEqual(canEditGift(ent, gift, 'mallory'), { allowed: false, reason: 'not_owner' });
  assert.deepEqual(canPublishGift(ent, gift, 'mallory'), { allowed: false, reason: 'not_owner' });
  assert.deepEqual(canArchiveOrDeleteGift(gift, 'mallory'), { allowed: false, reason: 'not_owner' });
});

test('MODEL B: published gift survives owner expiry; edits blocked; renewal restores editing; slug unchanged', () => {
  const alice = 'alice';
  const slug = 'abcdefghjkmn';
  const gift = { ownerUid: alice, status: 'published' as const };
  const publicDoc = { slug, status: 'published' as const };

  // Active Basic package: can edit and publish.
  const s1 = sub('basic', T0);
  const during = resolveEntitlement([s1], T0 + DAY_MS);
  assert.equal(canEditGift(during, gift, alice).allowed, true);
  assert.equal(canPublishGift(during, gift, alice).allowed, true);

  // Package expires (controlled clock: 10 days later).
  const after = resolveEntitlement([s1], T0 + 10 * DAY_MS);
  assert.equal(after.state, 'expired');
  assert.deepEqual(canEditGift(after, gift, alice), { allowed: false, reason: 'subscription_expired' });
  assert.deepEqual(canPublishGift(after, gift, alice), { allowed: false, reason: 'subscription_expired' });
  assert.deepEqual(canCreateGift(after, { giftsCreatedUnderCurrent: 0, templateTier: 'core' }), { allowed: false, reason: 'subscription_expired' });

  // The public gift is still visible: the visibility check cannot see subscriptions.
  assert.equal(isPublicGiftVisible(publicDoc), true);
  assert.equal(isPublicGiftVisible.length, 1);

  // The owner can still take it down.
  assert.deepEqual(canArchiveOrDeleteGift(gift, alice), { allowed: true });

  // Renewal: a new subscription from a new approved order.
  const s2 = sub('plus', T0 + 10 * DAY_MS);
  const renewed = resolveEntitlement([s1, s2], T0 + 11 * DAY_MS);
  assert.equal(renewed.state, 'active');
  assert.equal(canEditGift(renewed, gift, alice).allowed, true);
  // Same gift, same slug: nothing in the entitlement layer touches either.
  assert.equal(publicDoc.slug, slug);
  assert.equal(isPublicGiftVisible(publicDoc), true);
});

test('archive hides, restore needs an active package, deleted stays deleted', () => {
  const alice = 'alice';
  const archived = { ownerUid: alice, status: 'archived' as const };
  const expired = resolveEntitlement([sub('basic', T0)], T0 + 9 * DAY_MS);
  assert.equal(isPublicGiftVisible({ status: 'archived' }), false);
  assert.equal(isPublicGiftVisible({ status: 'removed' }), false);
  assert.deepEqual(canUnarchiveGift(expired, archived, alice), { allowed: false, reason: 'subscription_expired' });
  const active = resolveEntitlement([sub('basic', T0)], T0 + 1000);
  assert.equal(canUnarchiveGift(active, archived, alice).allowed, true);
  assert.deepEqual(canEditGift(active, archived, alice), { allowed: false, reason: 'gift_archived' });
  assert.deepEqual(canEditGift(active, { ownerUid: alice, status: 'deleted' }, alice), { allowed: false, reason: 'gift_deleted' });
  assert.deepEqual(canUnarchiveGift(active, { ownerUid: alice, status: 'draft' }, alice), { allowed: false, reason: 'gift_not_archived' });
});

test('revoked subscriptions grant nothing; longest-lasting active wins', () => {
  assert.equal(resolveEntitlement([sub('premium', T0, 30, 'revoked')], T0 + 1000).state, 'none');
  const ent = resolveEntitlement([sub('basic', T0), sub('premium', T0)], T0 + 1000);
  assert.equal(ent.current?.packageSnapshot.packageId, 'premium');
});

test('media upload is disabled by default and cannot be enabled by a package', () => {
  assert.equal(MEDIA_UPLOAD_ENABLED, false);
  const premium = resolveEntitlement([sub('premium', T0)], T0 + 1000);
  assert.deepEqual(canAddPhoto(premium, 0), { allowed: false, reason: 'media_unavailable' });
  assert.deepEqual(canAddAudio(premium), { allowed: false, reason: 'media_unavailable' });
});

test('with media enabled (future), package limits apply', () => {
  const basic = resolveEntitlement([sub('basic', T0)], T0 + 1000);
  const plus = resolveEntitlement([sub('plus', T0)], T0 + 1000);
  assert.equal(canAddPhoto(basic, 7, true).allowed, true);
  assert.deepEqual(canAddPhoto(basic, 8, true), { allowed: false, reason: 'photo_limit_reached' });
  assert.deepEqual(canAddAudio(basic, true), { allowed: false, reason: 'media_not_in_package' });
  assert.equal(canAddAudio(plus, true).allowed, true);
  const expired = resolveEntitlement([sub('plus', T0)], T0 + 20 * DAY_MS);
  assert.deepEqual(canAddPhoto(expired, 0, true), { allowed: false, reason: 'subscription_expired' });
});

test('order state machine: only a submitted proof can be approved', () => {
  assert.equal(canTransitionOrder('awaiting_payment', 'approved'), false);
  assert.equal(canTransitionOrder('proof_submitted', 'approved'), true);
  assert.equal(canTransitionOrder('approved', 'rejected'), false);
  assert.equal(canTransitionOrder('rejected', 'proof_submitted'), true);
  assert.equal(canTransitionOrder('cancelled', 'proof_submitted'), false);
});

test('activation plan: starts at approval, uses frozen duration, refuses unreviewed orders', () => {
  const order = { status: 'proof_submitted' as const, packageSnapshot: snap('plus') };
  const plan = planSubscriptionActivation(order, T0);
  assert.deepEqual(plan.ok && [plan.startedAtMs, plan.expiresAtMs], [T0, T0 + 14 * DAY_MS]);
  assert.deepEqual(planSubscriptionActivation({ ...order, status: 'awaiting_payment' }, T0), { ok: false, reason: 'order_not_reviewable' });
  assert.deepEqual(planSubscriptionActivation({ ...order, status: 'approved' }, T0), { ok: false, reason: 'order_not_reviewable' });
  const bad = { status: 'proof_submitted' as const, packageSnapshot: { ...snap('plus'), durationDays: 0 } };
  assert.deepEqual(planSubscriptionActivation(bad, T0), { ok: false, reason: 'invalid_duration' });
});
