import assert from 'node:assert/strict';
import test from 'node:test';
import * as guest from '../../lib/server/guest-services.ts';
import * as services from '../../lib/server/services.ts';
import { lookupTemplate } from '../../lib/server/template-lookup.ts';
import { sampleContent } from '../../lib/engine/resolve.ts';
import { chapterOfUs } from '../../lib/engine/templates/chapter-of-us.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'owner-admin', admin: true };
const T0 = Date.UTC(2026, 10, 1);

test('guest purchase approval assigns its draft slot and unlocks token-authorized publication', async () => {
  const h = makeEnv(T0);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'bank-transfer', name: 'Bank transfer', instructions: 'Transfer to the listed account.', active: true, sortOrder: 0 })).ok);
  const content = sampleContent(chapterOfUs, 'en');
  const createdGift = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content }, lookupTemplate);
  assert.ok(createdGift.ok);
  if (!createdGift.ok) return;

  const beforePurchase = await guest.getGuestGiftDraft(h.env, createdGift.giftId, createdGift.editToken);
  assert.ok(beforePurchase.ok);
  if (beforePurchase.ok) assert.equal(beforePurchase.publication.canPublish, false);
  const order = await guest.createGuestOrder(h.env, {
    giftId: createdGift.giftId, editToken: createdGift.editToken, idempotencyKey: 'c'.repeat(64), packageId: 'basic',
    email: 'customer@example.com', whatsapp: '+62812345678', paymentMethodId: 'bank-transfer',
  });
  assert.ok(order.ok);
  if (!order.ok) return;

  const privateOrder = await guest.getGuestOrderDetail(h.env, order.orderId, order.orderAccessToken);
  assert.ok(privateOrder.ok);
  if (privateOrder.ok) {
    assert.equal(privateOrder.order.giftId, createdGift.giftId);
    assert.equal(privateOrder.order.giftSlug, null);
    assert.equal('customerEmail' in privateOrder.order, false);
    assert.equal('customerWhatsapp' in privateOrder.order, false);
  }
  const blocked = await guest.publishGuestGift(h.env, createdGift.giftId, createdGift.editToken, { expectedVersion: 1 }, lookupTemplate);
  assert.deepEqual([blocked.ok, !blocked.ok && blocked.code], [false, 'no_subscription']);
  assert.equal(h.store.docs.has(`publicGifts/${createdGift.slug}`), false);

  h.store.docs.set(`orders/${order.orderId}`, {
    ...h.store.docs.get(`orders/${order.orderId}`)!, status: 'proof_submitted',
    proof: { storagePath: `payment-proofs/${order.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 1024, submittedAt: h.env.ts(T0) },
  });
  const approved = await services.approveOrder(h.env, admin, order.orderId);
  assert.ok(approved.ok);
  if (!approved.ok) return;
  const assignedGift = h.store.docs.get(`gifts/${createdGift.giftId}`)!;
  assert.equal(assignedGift.createdUnderSubscriptionId, approved.subscriptionId);

  const afterApproval = await guest.getGuestGiftDraft(h.env, createdGift.giftId, createdGift.editToken);
  assert.ok(afterApproval.ok);
  if (afterApproval.ok) assert.equal(afterApproval.publication.canPublish, true);
  const approvedButUnpublished = await guest.getGuestOrderDetail(h.env, order.orderId, order.orderAccessToken);
  assert.ok(approvedButUnpublished.ok);
  if (approvedButUnpublished.ok) assert.equal(approvedButUnpublished.order.giftSlug, null);
  const wrongToken = await guest.publishGuestGift(h.env, createdGift.giftId, `${createdGift.editToken}wrong`, { expectedVersion: 1 }, lookupTemplate);
  assert.deepEqual([wrongToken.ok, !wrongToken.ok && wrongToken.code], [false, 'edit_link_invalid']);

  const published = await guest.publishGuestGift(h.env, createdGift.giftId, createdGift.editToken, { expectedVersion: 1 }, lookupTemplate);
  assert.ok(published.ok);
  if (!published.ok) return;
  assert.equal(published.slug, createdGift.slug);
  assert.equal(h.store.docs.get(`publicGifts/${createdGift.slug}`)?.status, 'published');
  assert.equal(h.store.docs.get(`gifts/${createdGift.giftId}`)?.publishedRevision, 1);
  const publishedOrder = await guest.getGuestOrderDetail(h.env, order.orderId, order.orderAccessToken);
  assert.ok(publishedOrder.ok);
  if (publishedOrder.ok) assert.equal(publishedOrder.order.giftSlug, createdGift.slug);
});


test('admin approval refuses a linked gift owned by a different guest token', async () => {
  const h = makeEnv(T0);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'bank-transfer', name: 'Bank transfer', instructions: 'Transfer to the listed account.', active: true, sortOrder: 0 })).ok);
  const content = sampleContent(chapterOfUs, 'en');
  const ownerGift = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content }, lookupTemplate);
  const foreignGift = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content }, lookupTemplate);
  assert.ok(ownerGift.ok && foreignGift.ok);
  if (!ownerGift.ok || !foreignGift.ok) return;
  const order = await guest.createGuestOrder(h.env, {
    giftId: ownerGift.giftId, editToken: ownerGift.editToken, idempotencyKey: 'd'.repeat(64), packageId: 'basic',
    email: 'customer@example.com', whatsapp: '+62812345678', paymentMethodId: 'bank-transfer',
  });
  assert.ok(order.ok);
  if (!order.ok) return;
  h.store.docs.set(`orders/${order.orderId}`, { ...h.store.docs.get(`orders/${order.orderId}`)!, giftId: foreignGift.giftId, status: 'proof_submitted', proof: { storagePath: `payment-proofs/${order.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 1024, submittedAt: h.env.ts(T0) } });
  const result = await services.approveOrder(h.env, admin, order.orderId);
  assert.deepEqual([result.ok, !result.ok && result.code], [false, 'order_gift_mismatch']);
  assert.equal([...h.store.docs.keys()].some((path) => path.startsWith('subscriptions/sub_')), false);
});
