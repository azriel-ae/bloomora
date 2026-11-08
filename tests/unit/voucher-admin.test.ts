import assert from 'node:assert/strict';
import test from 'node:test';
import * as services from '../../lib/server/services.ts';
import { createGuestGift, createGuestOrder } from '../../lib/server/guest-services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'owner', admin: true };
const customer: services.Actor = { uid: 'customer', admin: false };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };
const voucher = (overrides: Record<string, unknown> = {}) => ({
  code: 'SAVE10', active: true, discount: { kind: 'percent', value: 10 }, startsAtMs: null, expiresAtMs: null,
  maxUses: 1, minimumAmountIdr: 10000, ...overrides,
});

let idempotencyCounter = 0;

async function checkoutFixture() {
  const h = makeEnv(1_800_000_000_000);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'QRIS', instructions: 'Pay by QRIS.', active: true, sortOrder: 1 })).ok);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) throw new Error('gift setup failed');
  return { ...h, gift };
}

function orderInput(gift: { giftId: string; editToken: string }, voucherCode = 'SAVE10') {
  const idempotencyKey = `test${(++idempotencyCounter).toString(16).padStart(60, '0')}`;
  return { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey, packageId: 'plus', email: 'guest@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris', voucherCode };
}

test('voucher CRUD is admin-only, validates dates and limits, preserves counters and soft-deletes safely', async () => {
  const h = await checkoutFixture();
  const denied = await services.saveVoucher(h.env, customer, voucher());
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const invalidCode = await services.saveVoucher(h.env, admin, voucher({ code: 'bad code' }));
  assert.deepEqual([invalidCode.ok, !invalidCode.ok && invalidCode.code], [false, 'invalid_code']);
  const invalidWindow = await services.saveVoucher(h.env, admin, voucher({ startsAtMs: 200, expiresAtMs: 100 }));
  assert.deepEqual([invalidWindow.ok, !invalidWindow.ok && invalidWindow.code], [false, 'invalid_date_range']);

  assert.ok((await services.saveVoucher(h.env, admin, voucher())).ok);
  const order = await createGuestOrder(h.env, orderInput(h.gift));
  assert.ok(order.ok);
  if (!order.ok) return;
  assert.equal(order.originalAmountIdr, 39000);
  assert.equal(order.discountIdr, 3900);
  assert.equal(order.amountIdr, 35100);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.usedCount, 1);

  h.store.docs.set('vouchers/SAVE10', { ...h.store.docs.get('vouchers/SAVE10')!, usedCount: 2 });
  const editBelowUsage = await services.saveVoucher(h.env, admin, voucher({ maxUses: 1 }));
  assert.deepEqual([editBelowUsage.ok, !editBelowUsage.ok && editBelowUsage.code], [false, 'voucher_max_uses_below_used_count']);
  h.store.docs.set('vouchers/SAVE10', { ...h.store.docs.get('vouchers/SAVE10')!, usedCount: 1 });
  const deleted = await services.deleteVoucher(h.env, admin, 'SAVE10');
  assert.ok(deleted.ok);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.active, false);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.deleted, true);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.usedCount, 1);
  const reuse = await createGuestOrder(h.env, orderInput(h.gift));
  assert.deepEqual([reuse.ok, !reuse.ok && reuse.code], [false, 'voucher_inactive']);

  const listed = await services.listAdminVouchers(h.env, admin);
  assert.ok(listed.ok && listed.vouchers[0]?.deleted === true && listed.vouchers[0]?.usedCount === 1);
  assert.equal([...h.store.docs.keys()].filter((key) => key.startsWith('adminAuditLogs/')).length, 3);
});

test('voucher reservation is atomic under concurrent guest checkouts and maxUses is never exceeded', async () => {
  const h = await checkoutFixture();
  assert.ok((await services.saveVoucher(h.env, admin, voucher({ maxUses: 1 }))).ok);
  const [first, second] = await Promise.all([
    createGuestOrder(h.env, orderInput(h.gift)),
    createGuestOrder(h.env, orderInput(h.gift)),
  ]);
  assert.equal([first, second].filter((result) => result.ok).length, 1);
  const rejected = [first, second].find((result) => !result.ok);
  assert.ok(rejected && !rejected.ok && rejected.code === 'voucher_usage_limit');
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.usedCount, 1);
  assert.equal([...h.store.docs.keys()].filter((key) => key.startsWith('orders/')).length, 1);
});

test('voucher date window and minimum amount are checked before reserving usage', async () => {
  const h = await checkoutFixture();
  assert.ok((await services.saveVoucher(h.env, admin, voucher({ startsAtMs: h.env.nowMs() + 1, maxUses: 2 }))).ok);
  const early = await createGuestOrder(h.env, orderInput(h.gift));
  assert.deepEqual([early.ok, !early.ok && early.code], [false, 'voucher_not_started']);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.usedCount, 0);

  assert.ok((await services.saveVoucher(h.env, admin, voucher({ startsAtMs: null, minimumAmountIdr: 50000, maxUses: 2 }))).ok);
  const belowMinimum = await createGuestOrder(h.env, orderInput(h.gift));
  assert.deepEqual([belowMinimum.ok, !belowMinimum.ok && belowMinimum.code], [false, 'voucher_minimum_not_met']);
  assert.equal(h.store.docs.get('vouchers/SAVE10')!.usedCount, 0);
});
