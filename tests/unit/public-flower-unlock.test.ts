import assert from 'node:assert/strict';
import test from 'node:test';
import { unlockPublicFlowerGift } from '../../lib/server/services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const SLUG = 'abc234def567';
const GIFT_ID = 'gift_flower_1';
const T0 = Date.UTC(2026, 10, 1);

function publishFixture(templateId = 'interactive-flower-adventure') {
  const h = makeEnv(T0);
  const content = {
    fields: {
      recipientName: 'Maya',
      closingLine: 'The private note stays after unlocking.',
      signature: 'Arga',
      pinCode: '4072',
    },
    sections: ['opening', 'closing'],
    data: {},
    media: [{ id: 'photo_1', kind: 'image' as const, path: `private/${GIFT_ID}/photo_1.jpg` }],
  };
  h.store.docs.set(`publicGifts/${SLUG}`, {
    slug: SLUG, status: 'published', templateId, templateVersion: 1, revision: 2,
    // This public presentation deliberately does not contain the authoritative PIN/content.
    content: { fields: { pinCode: '9999', closingLine: 'public presentation' }, sections: ['closing'], data: {}, media: [] },
    publishedAt: h.env.ts(T0), updatedAt: h.env.ts(T0), schemaVersion: 2,
  });
  h.store.docs.set(`slugs/${SLUG}`, { giftId: GIFT_ID, ownerUid: 'owner-1', createdAt: h.env.ts(T0) });
  h.store.docs.set(`gifts/${GIFT_ID}`, {
    slug: SLUG, status: 'published', templateId, templateVersion: 1, publishedRevision: 2,
  });
  h.store.docs.set(`gifts/${GIFT_ID}/revisions/2`, {
    number: 2, templateId, templateVersion: 1, content, createdAt: h.env.ts(T0),
  });
  return h;
}

test('published flower gift unlocks against its private revision and removes PIN while preserving note and media', async () => {
  const h = publishFixture();
  const result = await unlockPublicFlowerGift(h.env, SLUG, '4072', 'hashed-client-identity');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.templateId, 'interactive-flower-adventure');
  assert.equal(result.templateVersion, 1);
  assert.equal(result.content.fields.closingLine, 'The private note stays after unlocking.');
  assert.equal('pinCode' in result.content.fields, false);
  assert.deepEqual(result.content.media, [{ id: 'photo_1', kind: 'image', path: `private/${GIFT_ID}/photo_1.jpg` }]);
});

test('incorrect PIN returns no gift content', async () => {
  const h = publishFixture();
  const result = await unlockPublicFlowerGift(h.env, SLUG, '4073', 'hashed-client-identity');
  assert.deepEqual(result, { ok: false, status: 401, code: 'wrong_pin', detail: undefined });
  assert.equal('content' in result, false);
});

test('non-flower gifts and invalid PIN formats are rejected', async () => {
  const nonFlower = await unlockPublicFlowerGift(publishFixture('chapter-of-us').env, SLUG, '4072', 'client-1');
  assert.deepEqual(nonFlower, { ok: false, status: 404, code: 'gift_not_found', detail: undefined });

  const h = publishFixture();
  const invalidPin = await unlockPublicFlowerGift(h.env, SLUG, '40a2', 'client-2');
  assert.deepEqual(invalidPin, { ok: false, status: 400, code: 'invalid_pin', detail: undefined });
  assert.equal('content' in invalidPin, false);
});

test('more than five unlock attempts in fifteen minutes are denied', async () => {
  const h = publishFixture();
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await unlockPublicFlowerGift(h.env, SLUG, '0000', 'hashed-client-identity');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'wrong_pin');
  }
  const limited = await unlockPublicFlowerGift(h.env, SLUG, '4072', 'hashed-client-identity');
  assert.equal(limited.ok, false);
  if (!limited.ok) {
    assert.equal(limited.status, 429);
    assert.equal(limited.code, 'rate_limited');
  }
  assert.equal('content' in limited, false);
});
