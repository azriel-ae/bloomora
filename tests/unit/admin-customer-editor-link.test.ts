import assert from 'node:assert/strict';
import test from 'node:test';
import * as guest from '../../lib/server/guest-services.ts';
import * as services from '../../lib/server/services.ts';
import { hashEditToken } from '../../lib/security/edit-token.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'admin-user', admin: true };
const customer: services.Actor = { uid: 'customer-user', admin: false };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };
const T0 = Date.UTC(2026, 10, 1);
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

async function fixture() {
  const h = makeEnv(T0);
  const created = await guest.createGuestGift(h.env, { templateId: 'pressed-garden', content }, lookup);
  assert.ok(created.ok);
  if (!created.ok) throw new Error('gift setup failed');
  const giftPath = `gifts/${created.giftId}`;
  const gift = h.store.docs.get(giftPath);
  assert.ok(gift);
  h.store.docs.set(giftPath, { ...gift, editTokenExpiresAt: h.env.ts(T0 + 60 * 24 * 60 * 60 * 1000) });
  h.store.docs.set('orders/order-editor-link', { giftId: created.giftId, userId: gift.ownerUid, deletedAt: null });
  return { ...h, gift: created };
}

test('only admins can issue a separate editor link and raw token is returned only in the `/editor/link/` URL', async () => {
  const h = await fixture();
  const denied = await services.createAdminCustomerEditorLink(h.env, customer, 'order-editor-link');
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, 'admin_required');
  assert.equal([...h.store.docs.keys()].filter((path) => path.startsWith('guestEditLinks/')).length, 0);

  const issued = await services.createAdminCustomerEditorLink(h.env, admin, 'order-editor-link');
  assert.ok(issued.ok);
  if (!issued.ok) return;
  assert.equal(issued.expiresAtMs, T0 + THIRTY_DAYS);
  const url = new URL(issued.editorUrl);
  assert.equal(url.pathname.startsWith('/editor/link/'), true);
  const token = url.pathname.split('/').at(-1)!;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(h.store.docs.has(`guestEditLinks/${hashEditToken(token)}`), true);
  assert.equal(h.store.docs.has(`guestEditLinks/${token}`), false);
  assert.equal(JSON.stringify([...h.store.docs.entries()]).includes(token), false);

  const originalStillWorks = await guest.resolveGuestEditToken(h.env, h.gift.editToken);
  const separateLinkWorks = await guest.resolveGuestEditToken(h.env, token);
  assert.ok(originalStillWorks.ok && separateLinkWorks.ok);
  if (originalStillWorks.ok && separateLinkWorks.ok) {
    assert.equal(originalStillWorks.giftId, h.gift.giftId);
    assert.equal(separateLinkWorks.giftId, h.gift.giftId);
  }
});

test('a separate customer editor link expires after 30 days while the original link remains valid', async () => {
  const h = await fixture();
  const issued = await services.createAdminCustomerEditorLink(h.env, admin, 'order-editor-link');
  assert.ok(issued.ok);
  if (!issued.ok) return;
  const token = new URL(issued.editorUrl).pathname.split('/').at(-1)!;

  h.advance(THIRTY_DAYS);
  const expired = await guest.resolveGuestEditToken(h.env, token);
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.code, 'edit_link_expired');
  const originalStillWorks = await guest.resolveGuestEditToken(h.env, h.gift.editToken);
  assert.ok(originalStillWorks.ok);
});
