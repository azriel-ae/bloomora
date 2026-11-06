import assert from 'node:assert/strict';
import test from 'node:test';
import * as services from '../../lib/server/services.ts';
import { createGuestGift, createGuestOrder } from '../../lib/server/guest-services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'owner', admin: true };
const customer: services.Actor = { uid: 'customer', admin: false };
const anonymous: services.Actor = { uid: '', admin: false };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };

const method = (overrides: Record<string, unknown> = {}) => ({
  id: 'bank-transfer', name: 'Bank transfer', instructions: 'Transfer the exact amount to the account shown by support.', active: true, sortOrder: 1, ...overrides,
});

test('admin-only payment method management validates fields, sorts records, and serves active methods only', async () => {
  const h = makeEnv(1_800_000_000_000);
  const denied = await services.savePaymentMethod(h.env, anonymous, method());
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const customerDenied = await services.savePaymentMethod(h.env, customer, method());
  assert.deepEqual([customerDenied.ok, !customerDenied.ok && customerDenied.code], [false, 'admin_required']);
  const invalid = await services.savePaymentMethod(h.env, admin, method({ id: 'bad id' }));
  assert.deepEqual([invalid.ok, !invalid.ok && invalid.code], [false, 'invalid_payment_method_id']);

  assert.ok((await services.savePaymentMethod(h.env, admin, method({ id: 'bank-transfer', sortOrder: 20 }))).ok);
  assert.ok((await services.savePaymentMethod(h.env, admin, method({ id: 'qris', name: 'QRIS', sortOrder: 5 }))).ok);
  assert.ok((await services.savePaymentMethod(h.env, admin, method({ id: 'inactive', active: false, sortOrder: 0 }))).ok);

  const publicList = await services.listActivePaymentMethods(h.env);
  assert.ok(publicList.ok);
  if (!publicList.ok) return;
  assert.deepEqual(publicList.methods.map(({ id }) => id), ['qris', 'bank-transfer']);
  assert.ok(publicList.methods.every((item) => item.active));
  assert.ok(!JSON.stringify(publicList.methods).includes('updatedBy'));

  const adminList = await services.listAdminPaymentMethods(h.env, admin);
  assert.ok(adminList.ok);
  if (!adminList.ok) return;
  assert.deepEqual(adminList.methods.map(({ id }) => id), ['inactive', 'qris', 'bank-transfer']);

  const disable = await services.savePaymentMethod(h.env, admin, method({ id: 'bank-transfer', active: false, sortOrder: 20 }));
  assert.ok(disable.ok);
  const afterDisable = await services.listActivePaymentMethods(h.env);
  assert.ok(afterDisable.ok && afterDisable.methods.map(({ id }) => id).join(',') === 'qris');
  assert.equal([...h.store.docs.keys()].filter((key) => key.startsWith('adminAuditLogs/')).length, 4);
});

test('only admins can save bank, e-wallet, and QRIS without cross-type fields', async () => {
  const h = makeEnv(1_800_000_000_000);
  const staff: services.Actor = { uid: 'authenticated-staff', admin: false };

  const denied = await services.savePaymentMethod(h.env, staff, method({
    id: 'bri-transfer', name: 'BRI transfer', paymentType: 'bank_transfer', providerName: 'BRI',
    accountNumber: '123456789', accountHolder: 'Bloomora', instructions: '',
  }));
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const bank = await services.savePaymentMethod(h.env, admin, method({
    id: 'bri-transfer', name: 'BRI transfer', paymentType: 'bank_transfer', providerName: 'BRI',
    accountNumber: '123456789', accountHolder: 'Bloomora', instructions: '',
  }));
  assert.equal(bank.ok, true);
  if (bank.ok) assert.equal(bank.method.paymentType, 'bank_transfer');

  const invalidBank = await services.savePaymentMethod(h.env, admin, method({ paymentType: 'bank_transfer', providerName: 'BCA' }));
  assert.deepEqual([invalidBank.ok, !invalidBank.ok && invalidBank.code], [false, 'bank_payment_details_required']);
  const invalidWallet = await services.savePaymentMethod(h.env, admin, method({ paymentType: 'e_wallet', providerName: 'DANA' }));
  assert.deepEqual([invalidWallet.ok, !invalidWallet.ok && invalidWallet.code], [false, 'ewallet_payment_details_required']);

  const wallet = await services.savePaymentMethod(h.env, admin, method({
    id: 'dana', name: 'DANA', paymentType: 'e_wallet', providerName: 'DANA', accountNumber: '08123456789',
  }));
  assert.equal(wallet.ok, true);
  const qris = await services.savePaymentMethod(h.env, admin, method({
    id: 'qris', name: 'QRIS', paymentType: 'qris', providerName: null, accountNumber: null, accountHolder: null, instructions: '',
  }));
  assert.equal(qris.ok, true);

  const methods = await services.listAdminPaymentMethods(h.env, admin);
  assert.equal(methods.ok, true);
  if (methods.ok) assert.deepEqual(methods.methods.map((item) => item.paymentType).sort(), ['bank_transfer', 'e_wallet', 'qris']);
  const updated = await services.savePaymentMethod(h.env, admin, method({ id: 'qris', name: 'QRIS Updated', paymentType: 'qris', active: false }));
  assert.equal(updated.ok, true);
  if (updated.ok) assert.equal(updated.method.active, false);
});

test('QRIS display settings are admin-only, persisted, and sanitized for public reads', async () => {
  const h = makeEnv(1_800_000_000_000);
  const denied = await services.saveQrisDisplay(h.env, customer, { title: 'Nope', backgroundColor: 'javascript:bad' });
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const saved = await services.saveQrisDisplay(h.env, admin, {
    title: 'Bayar dengan tenang', description: 'Scan kode asli di bawah.', backgroundColor: '#112233', accentColor: '#445566',
    borderColor: '#778899', footer: 'Bloomora', frameStyle: 'minimal', decoration: 'petals', logoUrl: 'javascript:bad',
  });
  assert.equal(saved.ok, true);
  const publicRead = await services.getQrisDisplay(h.env);
  assert.equal(publicRead.ok, true);
  if (publicRead.ok) assert.deepEqual(publicRead.qrisDisplay, { title: 'Bayar dengan tenang', description: 'Scan kode asli di bawah.', backgroundColor: '#112233', accentColor: '#445566', borderColor: '#778899', footer: 'Bloomora', logoUrl: null, frameStyle: 'minimal', decoration: 'petals' });
});

test('missing typed-payment columns return a specific safe schema error and redact sensitive log values', async () => {
  const h = makeEnv(1_800_000_000_000);
  h.store.runTransaction = async () => {
    throw Object.assign(new Error('column "payment_type" of relation "payment_methods" does not exist; token=secret-value'), { code: '42703' });
  };
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const result = await services.savePaymentMethod(h.env, admin, method());
    assert.deepEqual([result.ok, !result.ok && result.status, !result.ok && result.code], [false, 503, 'payment_method_schema_outdated']);
  } finally { console.error = originalError; }
  assert.match(JSON.stringify(logged), /payment_type/);
  assert.doesNotMatch(JSON.stringify(logged), /secret-value/);
});

test('unrelated schema errors are not mislabeled as payment-method schema outdated', async () => {
  const h = makeEnv(1_800_000_000_000);
  h.store.runTransaction = async () => {
    throw Object.assign(new Error('column "missing_column" of relation "admin_audit_logs" does not exist'), { code: '42703' });
  };
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const result = await services.savePaymentMethod(h.env, admin, method());
    assert.deepEqual([result.ok, !result.ok && result.code], [false, 'payment_method_audit_schema_outdated']);
  } finally { console.error = originalError; }
});

test('guest order accepts only configured active payment methods and never trusts a browser method id', async () => {
  const h = makeEnv(1_800_000_000_000);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) return;

  const base = { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: 'a'.repeat(64), packageId: 'basic', email: 'guest@example.com', whatsapp: '+62812345678' };
  const unconfigured = await createGuestOrder(h.env, { ...base, paymentMethodId: 'qris' });
  assert.deepEqual([unconfigured.ok, !unconfigured.ok && unconfigured.code], [false, 'payment_method_unavailable']);

  assert.ok((await services.savePaymentMethod(h.env, admin, method({ id: 'qris' }))).ok);
  const inactive = await services.savePaymentMethod(h.env, admin, method({ id: 'bank-transfer', active: false }));
  assert.ok(inactive.ok);
  const rejected = await createGuestOrder(h.env, { ...base, paymentMethodId: 'bank-transfer' });
  assert.deepEqual([rejected.ok, !rejected.ok && rejected.code], [false, 'payment_method_unavailable']);

  const created = await createGuestOrder(h.env, { ...base, paymentMethodId: 'qris' });
  assert.ok(created.ok);
  if (!created.ok) return;
  const stored = h.store.docs.get(`orders/${created.orderId}`)!;
  assert.equal(stored.paymentMethodId, 'qris');
  assert.equal(stored.status, 'awaiting_payment');
});


test('package administration is admin-only and order snapshots remain immutable after package edits', async () => {
  const T0 = 1_800_000_000_000;
  const h = makeEnv(T0);
  const original = {
    id: 'plus', name: 'Plus', priceIdr: 39000, durationDays: 14, active: true, sortOrder: 2,
    limits: { maxGifts: 1, maxPhotos: 20, music: true, priorityReview: false, allowedTemplateTiers: ['core', 'extended'] },
  };
  const denied = await services.savePackage(h.env, customer, original);
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const invalid = await services.savePackage(h.env, admin, { ...original, priceIdr: -1 });
  assert.deepEqual([invalid.ok, !invalid.ok && invalid.code], [false, 'invalid_package_price']);
  assert.ok((await services.savePackage(h.env, admin, original)).ok);
  assert.ok((await services.savePaymentMethod(h.env, admin, method({ id: 'qris' }))).ok);

  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) return;
  const order = await createGuestOrder(h.env, { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: 'b'.repeat(64), packageId: 'plus', email: 'guest@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris' });
  assert.ok(order.ok);
  if (!order.ok) return;
  const orderDoc = h.store.docs.get(`orders/${order.orderId}`)!;
  assert.equal(orderDoc.packageSnapshot.priceIdr, 39000);
  assert.equal(orderDoc.packageSnapshot.durationDays, 14);

  const changed = await services.savePackage(h.env, admin, { ...original, name: 'Plus Updated', priceIdr: 52000, durationDays: 30, limits: { ...original.limits, maxGifts: 4 } });
  assert.ok(changed.ok);
  assert.deepEqual(h.store.docs.get(`orders/${order.orderId}`)!.packageSnapshot, orderDoc.packageSnapshot);
  assert.equal(h.store.docs.get(`orders/${order.orderId}`)!.amountIdr, 39000);

  h.store.docs.set(`orders/${order.orderId}`, { ...h.store.docs.get(`orders/${order.orderId}`)!, status: 'proof_submitted', proof: { storagePath: `payment-proofs/${order.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 1024, submittedAt: h.env.ts(T0) } });
  const approved = await services.approveOrder(h.env, admin, order.orderId);
  assert.ok(approved.ok);
  if (approved.ok) assert.equal(approved.expiresAtMs, T0 + 14 * 86_400_000);

  const disabled = await services.savePackage(h.env, admin, { ...original, active: false });
  assert.ok(disabled.ok);
  const active = await services.listActivePackages(h.env);
  assert.ok(active.ok && !active.packages.some((item) => item.id === 'plus'));
  const management = await services.listAdminPackages(h.env, admin);
  assert.ok(management.ok && management.packages.some((item) => item.id === 'plus' && !item.active));
});
