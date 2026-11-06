import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditToken, hashEditToken, verifyEditToken } from '../../lib/security/edit-token.ts';
import { isValidCustomSlug, normalizeCustomSlug, RESERVED_SLUGS } from '../../lib/slug.ts';
import { validateVoucher, validateVoucherDefinition } from '../../lib/commerce.ts';
import { consumeRateLimit } from '../../lib/security/rate-limit.ts';
import { makeEnv } from './helpers/fake-store.ts';

test('edit token has high entropy and only its hash verifies', () => {
  const token = createEditToken();
  assert.ok(token.length >= 40);
  const hash = hashEditToken(token);
  assert.equal(hash.length, 64);
  assert.equal(verifyEditToken(token, hash), true);
  assert.equal(verifyEditToken(`${token}x`, hash), false);
});

test('custom slugs normalize and reject reserved/path-like values', () => {
  assert.equal(normalizeCustomSlug('  Our Love Story! '), 'our-love-story');
  assert.equal(normalizeCustomSlug('A&B   for You'), 'ab-for-you');
  assert.equal(isValidCustomSlug('our-love-story'), true);
  assert.equal(isValidCustomSlug('admin'), false);
  assert.equal(isValidCustomSlug('edit'), false);
  assert.equal(RESERVED_SLUGS.has('admin'), true);
  assert.equal(isValidCustomSlug('a--b'), false);
});

test('voucher validation calculates server-side percent and fixed discounts', () => {
  const percent = { code: 'SAVE10', active: true, discount: { kind: 'percent' as const, value: 10 }, startsAtMs: null, expiresAtMs: null, maxUses: null, usedCount: 0, minimumAmountIdr: 10000 };
  assert.deepEqual(validateVoucher(percent, 39000, 1), { ok: true, code: 'SAVE10', discountIdr: 3900, finalAmountIdr: 35100 });
  const fixed = { ...percent, code: 'FIXED', discount: { kind: 'fixed' as const, valueIdr: 50000 } };
  assert.deepEqual(validateVoucher(fixed, 39000, 1), { ok: true, code: 'FIXED', discountIdr: 39000, finalAmountIdr: 0 });
  const oneRupiah = { ...percent, code: 'ONE_RUPIAH', discount: { kind: 'fixed' as const, valueIdr: 18999 } };
  assert.deepEqual(validateVoucher(oneRupiah, 19000, 1), { ok: true, code: 'ONE_RUPIAH', discountIdr: 18999, finalAmountIdr: 1 });
  assert.deepEqual(validateVoucherDefinition({ ...percent, discount: { kind: 'percent', value: 101 } }), ['invalid_percent']);
});

test('guest abuse limits are durable, owner-scoped, and reset after the window', async () => {
  const h = makeEnv(1_000);
  const policy = { max: 2, windowMs: 1_000 };
  const first = await h.store.runTransaction((tx) => consumeRateLimit(tx, 'guest-order-create', 'guest_a', 1_000, policy));
  const second = await h.store.runTransaction((tx) => consumeRateLimit(tx, 'guest-order-create', 'guest_a', 1_500, policy));
  const blocked = await h.store.runTransaction((tx) => consumeRateLimit(tx, 'guest-order-create', 'guest_a', 1_900, policy));
  const otherOwner = await h.store.runTransaction((tx) => consumeRateLimit(tx, 'guest-order-create', 'guest_b', 1_900, policy));
  const reset = await h.store.runTransaction((tx) => consumeRateLimit(tx, 'guest-order-create', 'guest_a', 2_001, policy));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(blocked.ok, false);
  assert.equal(otherOwner.ok, true);
  assert.equal(reset.ok, true);
  assert.equal([...h.store.docs.keys()].filter((path) => path.startsWith('rateLimits/')).length, 2);
});
