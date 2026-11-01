import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditToken, hashEditToken, verifyEditToken } from '../../lib/security/edit-token.ts';
import { isValidCustomSlug, normalizeCustomSlug, RESERVED_SLUGS } from '../../lib/slug.ts';
import { validateVoucher, validateVoucherDefinition } from '../../lib/commerce.ts';

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
  assert.equal(isValidCustomSlug('our-love-story'), true);
  assert.equal(isValidCustomSlug('admin'), false);
  assert.equal(RESERVED_SLUGS.has('admin'), true);
  assert.equal(isValidCustomSlug('a--b'), false);
});

test('voucher validation calculates server-side percent and fixed discounts', () => {
  const percent = { code: 'SAVE10', active: true, discount: { kind: 'percent' as const, value: 10 }, startsAtMs: null, expiresAtMs: null, maxUses: null, usedCount: 0, minimumAmountIdr: 10000 };
  assert.deepEqual(validateVoucher(percent, 39000, 1), { ok: true, code: 'SAVE10', discountIdr: 3900, finalAmountIdr: 35100 });
  const fixed = { ...percent, code: 'FIXED', discount: { kind: 'fixed' as const, valueIdr: 50000 } };
  assert.deepEqual(validateVoucher(fixed, 39000, 1), { ok: true, code: 'FIXED', discountIdr: 39000, finalAmountIdr: 0 });
  assert.deepEqual(validateVoucherDefinition({ ...percent, discount: { kind: 'percent', value: 101 } }), ['invalid_percent']);
});
