import assert from 'node:assert/strict';
import test from 'node:test';
import { hashEditToken } from '../../lib/security/edit-token.ts';
import { createGuestGift, createGuestOrder, deleteGuestOrder, getGuestOrderDetail, getGuestOrderOwnerForProof, getGuestOrderQrisImagePath, submitGuestPaymentProof } from '../../lib/server/guest-services.ts';
import * as services from '../../lib/server/services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'owner', admin: true };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };

test('guest order detail requires secret token, exposes no contact data, and freezes payment instructions', async () => {
  const h = makeEnv(1_800_000_000_000);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'QRIS Static', instructions: 'Transfer to merchant 123.', active: true, sortOrder: 1, paymentType: 'qris', providerName: 'Merchant QRIS', accountNumber: null, accountHolder: null, imageUrl: 'https://cdn.example/qr-before.png', imagePath: 'payment-methods/owner/qris/00000000-0000-4000-8000-000000000001.png', qrisDetectionStatus: 'confirmed' })).ok);
  assert.ok((await services.saveVoucher(h.env, admin, { code: 'SAVE10', active: true, discount: { kind: 'percent', value: 10 }, startsAtMs: null, expiresAtMs: null, maxUses: 5, minimumAmountIdr: 0 })).ok);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) return;
  const created = await createGuestOrder(h.env, { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: 'f'.repeat(64), packageId: 'plus', email: 'secret@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris', voucherCode: 'SAVE10' });
  assert.ok(created.ok);
  if (!created.ok) return;

  const saved = h.store.docs.get(`orders/${created.orderId}`)!;
  assert.equal(saved.orderAccessTokenHash, hashEditToken(created.orderAccessToken));
  assert.equal('orderAccessToken' in saved, false);
  assert.notEqual(saved.orderAccessTokenHash, created.orderAccessToken);
  assert.deepEqual(saved.paymentMethodSnapshot, {
    id: 'qris', name: 'QRIS Static', instructions: 'Transfer to merchant 123.', paymentType: 'qris',
    providerName: 'Merchant QRIS', accountNumber: null, accountHolder: null,
    imageUrl: 'https://cdn.example/qr-before.png', imagePath: 'payment-methods/owner/qris/00000000-0000-4000-8000-000000000001.png', qrisDetectionStatus: 'confirmed',
    qrisDisplay: { title: 'Scan untuk membayar', description: 'Gunakan aplikasi pembayaran pilihanmu.', backgroundColor: '#fffaf3', accentColor: '#66745d', borderColor: '#d9d1c5', footer: 'Bloomora · pembayaran aman', logoUrl: null, frameStyle: 'card', decoration: 'none' },
  });

  const anonymous = await getGuestOrderDetail(h.env, created.orderId, undefined);
  assert.deepEqual([anonymous.ok, !anonymous.ok && anonymous.code], [false, 'order_not_found']);
  const detail = await getGuestOrderDetail(h.env, created.orderId, created.orderAccessToken);
  assert.ok(detail.ok);
  if (!detail.ok) return;
  assert.equal(detail.order.originalAmountIdr, 39000);
  assert.equal(detail.order.discountIdr, 3900);
  assert.equal(detail.order.amountIdr, 35100);
  assert.equal(detail.order.paymentMethod.instructions, 'Transfer to merchant 123.');
  assert.equal(detail.order.paymentMethod.paymentType, 'qris');
  assert.equal(detail.order.paymentMethod.providerName, 'Merchant QRIS');
  assert.equal(detail.order.paymentMethod.imageUrl, 'https://cdn.example/qr-before.png');
  assert.equal(detail.order.paymentMethod.qrisDisplay?.title, 'Scan untuk membayar');
  assert.equal('customerEmail' in detail.order, false);
  assert.equal('customerWhatsapp' in detail.order, false);

  const deniedQrisPath = await getGuestOrderQrisImagePath(h.env, created.orderId, 'wrong-token');
  assert.deepEqual([deniedQrisPath.ok, !deniedQrisPath.ok && deniedQrisPath.status, !deniedQrisPath.ok && deniedQrisPath.code], [false, 404, 'order_not_found']);
  assert.deepEqual(await getGuestOrderQrisImagePath(h.env, created.orderId, created.orderAccessToken), { ok: true, imagePath: 'payment-methods/owner/qris/00000000-0000-4000-8000-000000000001.png' });

  assert.ok((await services.saveQrisDisplay(h.env, admin, { title: 'Judul baru', description: 'Konfigurasi baru.', backgroundColor: '#102030', accentColor: '#405060', borderColor: '#708090', footer: 'Footer baru', frameStyle: 'minimal', decoration: 'ribbon', logoUrl: '/favicon.svg' })).ok);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'New QRIS Name', instructions: 'New instructions.', active: false, sortOrder: 1 })).ok);
  const afterEdit = await getGuestOrderDetail(h.env, created.orderId, created.orderAccessToken);
  assert.ok(afterEdit.ok);
  if (afterEdit.ok) {
    assert.equal(afterEdit.order.paymentMethod.name, 'QRIS Static');
    assert.equal(afterEdit.order.paymentMethod.instructions, 'Transfer to merchant 123.');
    assert.equal(afterEdit.order.paymentMethod.imageUrl, 'https://cdn.example/qr-before.png');
    assert.equal(afterEdit.order.paymentMethod.qrisDisplay?.title, 'Scan untuk membayar', 'new design settings apply to later orders, not this frozen customer snapshot');
    assert.equal(afterEdit.order.paymentMethod.qrisDisplay?.footer, 'Bloomora · pembayaran aman');
    assert.equal(afterEdit.order.status, 'awaiting_payment');
  }

  const legacyOrder = h.store.docs.get(`orders/${created.orderId}`)!;
  h.store.docs.set(`orders/${created.orderId}`, { ...legacyOrder, paymentMethodSnapshot: { ...legacyOrder.paymentMethodSnapshot, qrisDetectionStatus: 'needs_confirmation' } });
  const legacy = await getGuestOrderDetail(h.env, created.orderId, created.orderAccessToken);
  assert.ok(legacy.ok);
  if (legacy.ok) assert.equal(legacy.order.paymentMethod.imageUrl, null);
  const legacyQrisPath = await getGuestOrderQrisImagePath(h.env, created.orderId, created.orderAccessToken);
  assert.deepEqual([legacyQrisPath.ok, !legacyQrisPath.ok && legacyQrisPath.status, !legacyQrisPath.ok && legacyQrisPath.code], [false, 404, 'qris_image_unavailable']);
});

test('guest proof submission requires the order token, validates private owner path and is one-way', async () => {
  const h = makeEnv(1_800_000_000_000);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'QRIS', instructions: 'Transfer.', active: true, sortOrder: 1 })).ok);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift);
  if (!gift.ok) return;
  const created = await createGuestOrder(h.env, { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: 'a'.repeat(64), packageId: 'plus', email: 'proof@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris' });
  assert.ok(created.ok);
  if (!created.ok) return;
  const wrong = await submitGuestPaymentProof(h.env, created.orderId, 'wrong-token', { storagePath: 'paymentProofs/attacker/order/file.png', contentType: 'image/png', sizeBytes: 100, fileSha256: 'a'.repeat(64) });
  assert.deepEqual([wrong.ok, !wrong.ok && wrong.code], [false, 'order_not_found']);
  const ownerUid = h.store.docs.get(`orders/${created.orderId}`)!.userId;
  const invalidPath = await submitGuestPaymentProof(h.env, created.orderId, created.orderAccessToken, { storagePath: `paymentProofs/other/${created.orderId}/file.png`, contentType: 'image/png', sizeBytes: 100, fileSha256: 'a'.repeat(64) });
  assert.deepEqual([invalidPath.ok, !invalidPath.ok && invalidPath.code], [false, 'invalid_proof_path']);
  const submitted = await submitGuestPaymentProof(h.env, created.orderId, created.orderAccessToken, { storagePath: `paymentProofs/${ownerUid}/${created.orderId}/file.png`, contentType: 'image/png', sizeBytes: 100, fileSha256: 'a'.repeat(64) });
  assert.deepEqual(submitted, { ok: true, status: 'proof_submitted' });
  const duplicate = await submitGuestPaymentProof(h.env, created.orderId, created.orderAccessToken, { storagePath: `paymentProofs/${ownerUid}/${created.orderId}/file-2.png`, contentType: 'image/png', sizeBytes: 100, fileSha256: 'a'.repeat(64) });
  assert.deepEqual([duplicate.ok, !duplicate.ok && duplicate.code], [false, 'order_not_reviewable']);
  const otherGift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(otherGift.ok);
  if (!otherGift.ok) return;
  const otherOrder = await createGuestOrder(h.env, { giftId: otherGift.giftId, editToken: otherGift.editToken, idempotencyKey: 'd'.repeat(64), packageId: 'plus', email: 'other-proof@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris' });
  assert.ok(otherOrder.ok);
  if (!otherOrder.ok) return;
  const otherOwner = await getGuestOrderOwnerForProof(h.env, otherOrder.orderId, otherOrder.orderAccessToken);
  assert.ok(otherOwner.ok);
  if (!otherOwner.ok) return;
  const reusedFile = await submitGuestPaymentProof(h.env, otherOrder.orderId, otherOrder.orderAccessToken, { storagePath: `paymentProofs/${otherOwner.ownerUid}/${otherOrder.orderId}/reused.png`, contentType: 'image/png', sizeBytes: 100, fileSha256: 'a'.repeat(64) });
  assert.deepEqual([reusedFile.ok, !reusedFile.ok && reusedFile.code], [false, 'proof_already_used']);
});

test('Gemini proof gate requires exact snapshot matches and refuses a reused transaction reference', async () => {
  const h = makeEnv(1_800_000_000_000);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'bank', name: 'BCA', instructions: 'Transfer.', active: true, sortOrder: 1, paymentType: 'bank_transfer', providerName: 'BCA', accountNumber: '123456', accountHolder: 'Bloomora Merchant' })).ok);
  const makeOrder = async (key: string) => {
    const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
    assert.ok(gift.ok);
    if (!gift.ok) throw new Error('gift_creation_failed');
    const created = await createGuestOrder(h.env, { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: key.repeat(64), packageId: 'plus', email: `${key}@example.com`, whatsapp: '+62812345678', paymentMethodId: 'bank' });
    assert.ok(created.ok);
    if (!created.ok) throw new Error('order_creation_failed');
    const order = h.store.docs.get(`orders/${created.orderId}`)!;
    const owner = await getGuestOrderOwnerForProof(h.env, created.orderId, created.orderAccessToken);
    assert.ok(owner.ok);
    if (!owner.ok) throw new Error('order_owner_not_found');
    const submitted = await submitGuestPaymentProof(h.env, created.orderId, created.orderAccessToken, { storagePath: `paymentProofs/${owner.ownerUid}/${created.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 100, fileSha256: key.repeat(64) });
    assert.ok(submitted.ok);
    h.store.docs.set(`orders/${created.orderId}`, { ...order, status: 'proof_submitted', proof: { storagePath: `paymentProofs/${owner.ownerUid}/${created.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 100, submittedAt: h.env.ts(h.env.nowMs()) }, proofAiVerification: { state: 'analyzed', recipient: 'Bloomora Merchant', accountNumber: '123456', amountIdr: 39000, paymentDate: '2026-11-05 09:00', transactionId: 'TRX-1234', confidence: 0.99, amountCheck: 'match', recipientCheck: 'match', accountNumberCheck: 'match', notes: [], analyzedAtMs: h.env.nowMs(), autoApproval: 'not_evaluated' } });
    return created.orderId;
  };
  const firstOrderId = await makeOrder('b');
  const first = await services.autoApproveGuestPaymentProof(h.env, firstOrderId);
  assert.equal(first.ok && first.status, 'approved');
  assert.equal(h.store.docs.get(`orders/${firstOrderId}`)?.status, 'approved');
  const secondOrderId = await makeOrder('c');
  const second = await services.autoApproveGuestPaymentProof(h.env, secondOrderId);
  assert.equal(second.ok && second.status, 'manual_review');
  assert.equal(second.ok && second.reason, 'duplicate_transaction');
  assert.equal(h.store.docs.get(`orders/${secondOrderId}`)?.status, 'proof_submitted');
});


test('owner can soft-delete only their own order with its bearer token, regardless of approval or subscription expiry', async () => {
  const h = makeEnv(1_800_000_000_000);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'QRIS', instructions: 'Transfer.', active: true, sortOrder: 1 })).ok);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) return;
  const created = await createGuestOrder(h.env, { giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: 'g'.repeat(64), packageId: 'basic', email: 'owner@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris' });
  assert.ok(created.ok);
  if (!created.ok) return;
  const wrong = await deleteGuestOrder(h.env, created.orderId, 'a-different-order-token');
  assert.deepEqual([wrong.ok, !wrong.ok && wrong.code], [false, 'order_not_found']);
  const order = h.store.docs.get(`orders/${created.orderId}`)!;
  const other = { ...order, userId: 'guest_other' };
  h.store.docs.set('orders/other-order', { ...other, orderAccessTokenHash: hashEditToken('other-token') });
  const cross = await deleteGuestOrder(h.env, 'other-order', created.orderAccessToken);
  assert.deepEqual([cross.ok, !cross.ok && cross.code], [false, 'order_not_found']);
  h.store.docs.set(`orders/${created.orderId}`, { ...order, status: 'approved', subscriptionId: 'sub_linked' });
  h.store.docs.set('subscriptions/sub_linked', { orderId: created.orderId, userId: order.userId, status: 'active', packageSnapshot: order.packageSnapshot });
  h.advance(40 * 86_400_000);
  assert.deepEqual(await deleteGuestOrder(h.env, created.orderId, created.orderAccessToken), { ok: true });
  assert.deepEqual(await deleteGuestOrder(h.env, created.orderId, created.orderAccessToken), { ok: true });
  const saved = h.store.docs.get(`orders/${created.orderId}`)!;
  assert.equal(saved.status, 'approved');
  assert.equal(saved.subscriptionId, 'sub_linked');
  assert.ok(saved.deletedAt);
  assert.equal(h.store.docs.has(`subscriptions/sub_linked`), true);
  assert.equal(h.store.docs.has(`gifts/${gift.giftId}`), true);
});
