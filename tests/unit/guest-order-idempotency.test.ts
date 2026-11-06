import assert from 'node:assert/strict';
import test from 'node:test';
import * as guest from '../../lib/server/guest-services.ts';
import * as services from '../../lib/server/services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'admin', admin: true };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };
const T0 = Date.UTC(2026, 10, 1);
const key = 'e'.repeat(64);

async function fixture() {
  const h = makeEnv(T0);
  assert.ok((await services.savePaymentMethod(h.env, admin, { id: 'qris', name: 'QRIS', instructions: 'Pay by QRIS.', active: true, sortOrder: 1 })).ok);
  assert.ok((await services.saveVoucher(h.env, admin, { code: 'ONEUSE', active: true, discount: { kind: 'fixed', valueIdr: 1000 }, startsAtMs: null, expiresAtMs: null, maxUses: 1, usedCount: 0, minimumAmountIdr: 0 })).ok);
  const gift = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(gift.ok);
  if (!gift.ok) throw new Error('gift setup failed');
  return { ...h, gift };
}

function input(gift: { giftId: string; editToken: string }, overrides: Record<string, unknown> = {}) {
  return {
    giftId: gift.giftId, editToken: gift.editToken, idempotencyKey: key, packageId: 'plus',
    email: 'guest@example.com', whatsapp: '+62812345678', paymentMethodId: 'qris', voucherCode: 'ONEUSE', ...overrides,
  };
}

test('concurrent guest checkout retries with one idempotency key create one order and reserve voucher once', async () => {
  const h = await fixture();
  const [first, second] = await Promise.all([
    guest.createGuestOrder(h.env, input(h.gift)),
    guest.createGuestOrder(h.env, input(h.gift)),
  ]);
  assert.ok(first.ok && second.ok);
  if (!first.ok || !second.ok) return;
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.amountIdr, 38000);
  assert.equal(second.amountIdr, 38000);
  assert.notEqual(first.orderAccessToken, second.orderAccessToken);
  assert.equal([...h.store.docs.keys()].filter((path) => path.startsWith('orders/')).length, 1);
  assert.equal(h.store.docs.get('vouchers/ONEUSE')?.usedCount, 1);
  const idempotencyRows = [...h.store.docs.entries()].filter(([path]) => path.startsWith('guestOrderIdempotency/'));
  assert.equal(idempotencyRows.length, 1);
  assert.equal('idempotencyKey' in idempotencyRows[0][1], false);

  const changedRetry = await guest.createGuestOrder(h.env, input(h.gift, { packageId: 'basic', email: 'changed@example.com', voucherCode: null }));
  assert.ok(changedRetry.ok);
  if (!changedRetry.ok) return;
  assert.equal(changedRetry.orderId, first.orderId);
  assert.equal(changedRetry.amountIdr, 38000);
  assert.equal(h.store.docs.get(`orders/${first.orderId}`)?.customerEmail, 'guest@example.com');
  assert.equal(h.store.docs.get('vouchers/ONEUSE')?.usedCount, 1);
  const oldToken = await guest.getGuestOrderDetail(h.env, first.orderId, first.orderAccessToken);
  assert.ok(oldToken.ok);
  const secondToken = await guest.getGuestOrderDetail(h.env, second.orderId, second.orderAccessToken);
  assert.ok(secondToken.ok);
  const currentToken = await guest.getGuestOrderDetail(h.env, changedRetry.orderId, changedRetry.orderAccessToken);
  assert.ok(currentToken.ok);
  if (currentToken.ok) assert.equal(currentToken.order.packageId, 'plus');
});

test('the idempotency record can be reused after its 48-hour replay window', async () => {
  const h = await fixture();
  const first = await guest.createGuestOrder(h.env, input(h.gift, { voucherCode: null }));
  assert.ok(first.ok);
  if (!first.ok) return;
  h.advance(48 * 60 * 60 * 1000 + 1);
  const nextIntent = await guest.createGuestOrder(h.env, input(h.gift, { voucherCode: null }));
  assert.ok(nextIntent.ok);
  if (!nextIntent.ok) return;
  assert.notEqual(nextIntent.orderId, first.orderId);
  assert.equal([...h.store.docs.keys()].filter((path) => path.startsWith('orders/')).length, 2);
});

test('guest checkout accepts either one valid contact channel and rejects no contact', async () => {
  const emailFixture = await fixture();
  const emailOnly = await guest.createGuestOrder(emailFixture.env, input(emailFixture.gift, { email: 'solo@example.com', whatsapp: '', voucherCode: null }));
  assert.ok(emailOnly.ok);
  if (emailOnly.ok) {
    const saved = emailFixture.store.docs.get(`orders/${emailOnly.orderId}`);
    assert.equal(saved?.customerEmail, 'solo@example.com');
    assert.equal(saved?.customerWhatsapp, null);
  }

  const whatsappFixture = await fixture();
  const whatsappOnly = await guest.createGuestOrder(whatsappFixture.env, input(whatsappFixture.gift, { email: '', whatsapp: '+62812345678', voucherCode: null }));
  assert.ok(whatsappOnly.ok);
  if (whatsappOnly.ok) {
    const saved = whatsappFixture.store.docs.get(`orders/${whatsappOnly.orderId}`);
    assert.equal(saved?.customerEmail, null);
    assert.equal(saved?.customerWhatsapp, '+62812345678');
  }

  const emptyFixture = await fixture();
  const noContact = await guest.createGuestOrder(emptyFixture.env, input(emptyFixture.gift, { email: '', whatsapp: '', voucherCode: null }));
  assert.equal(noContact.ok, false);
  if (!noContact.ok) assert.equal(noContact.code, 'contact_required');
});

test('custom checkout slug is reserved atomically and one of two competing gifts wins', async () => {
  const h = await fixture();
  const secondGift = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(secondGift.ok);
  if (!secondGift.ok) return;

  const [firstCheck, secondCheck] = await Promise.all([
    guest.checkGuestSlugAvailability(h.env, h.gift.giftId, h.gift.editToken, 'Happy Birthday Sarah'),
    guest.checkGuestSlugAvailability(h.env, secondGift.giftId, secondGift.editToken, 'Happy Birthday Sarah'),
  ]);
  assert.ok(firstCheck.ok && firstCheck.available);
  assert.ok(secondCheck.ok && secondCheck.available);

  const [firstOrder, secondOrder] = await Promise.all([
    guest.createGuestOrder(h.env, input(h.gift, { customSlug: 'Happy Birthday Sarah', voucherCode: null })),
    guest.createGuestOrder(h.env, input(secondGift, { customSlug: 'happy-birthday-sarah', idempotencyKey: 'f'.repeat(64), voucherCode: null })),
  ]);
  const successes = [firstOrder, secondOrder].filter((result) => result.ok);
  const failures = [firstOrder, secondOrder].filter((result) => !result.ok);
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].ok ? '' : failures[0].code, 'slug_unavailable');
  const reservation = h.store.docs.get('slugs/happy-birthday-sarah');
  assert.ok(reservation);
  assert.equal(reservation?.giftId, firstOrder.ok ? h.gift.giftId : secondGift.giftId);
  const ownerGift = h.store.docs.get(`gifts/${String(reservation?.giftId)}`);
  assert.equal(ownerGift?.slug, 'happy-birthday-sarah');
});

test('a slug held only by an unpurchased draft is reclaimable without mass cleanup', async () => {
  const h = await fixture();
  const stale = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content, customSlug: 'davidddddaa' }, lookup);
  assert.ok(stale);
  if (!stale.ok) return;
  const next = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(next);
  if (!next.ok) return;
  const available = await guest.checkGuestSlugAvailability(h.env, next.giftId, next.editToken, 'davidddddaa');
  assert.ok(available.ok && available.available);
  const order = await guest.createGuestOrder(h.env, input(next, { customSlug: 'davidddddaa', voucherCode: null, idempotencyKey: 'd'.repeat(64) }));
  assert.ok(order.ok);
  assert.equal(h.store.docs.get(`gifts/${stale.giftId}`)?.slug === 'davidddddaa', false);
});

test('an unpaid slug hold is available again after the 48-hour checkout window', async () => {
  const h = await fixture();
  const first = await guest.createGuestOrder(h.env, input(h.gift, { customSlug: 'davidddddaa', voucherCode: null }));
  assert.ok(first);
  const secondGift = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(secondGift);
  if (!first.ok || !secondGift.ok) return;
  h.advance(48 * 60 * 60 * 1000 + 1);
  const available = await guest.checkGuestSlugAvailability(h.env, secondGift.giftId, secondGift.editToken, 'davidddddaa');
  assert.ok(available.ok && available.available);
  const second = await guest.createGuestOrder(h.env, input(secondGift, { customSlug: 'davidddddaa', voucherCode: null, idempotencyKey: 'g'.repeat(64) }));
  assert.ok(second.ok);
});

test('bearer edit URL resolves only its gift and invalid tokens are denied', async () => {
  const h = await fixture();
  const resolved = await guest.resolveGuestEditToken(h.env, h.gift.editToken);
  assert.ok(resolved.ok);
  if (resolved.ok) assert.equal(resolved.giftId, h.gift.giftId);
  const invalid = await guest.resolveGuestEditToken(h.env, 'x'.repeat(43));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, 'edit_link_invalid');
});
