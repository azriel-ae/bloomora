import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, Ts } from './helpers/fake-store.ts';
import * as S from '../../lib/server/services.ts';
import { DAY_MS } from '../../lib/entitlements.ts';

const lookup: S.TemplateLookup = (id) =>
  id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : id === 'our-little-archive' ? { id, tier: 'extended', version: 1 } : null;
const T0 = Date.UTC(2026, 10, 1);
const alice: S.Actor = { uid: 'alice', admin: false };
const mallory: S.Actor = { uid: 'mallory', admin: false };
const admin: S.Actor = { uid: 'root', admin: true };
const content = (msg = 'hello') => ({ fields: { title: 'T', message: msg }, sections: ['Opening', 'Letter'], data: {}, media: [] });

test('public read uses only publicGifts and remains available without an owner subscription', async () => {
  const h = makeEnv(T0);
  h.store.docs.set('publicGifts/abc234def567', {
    slug: 'abc234def567', status: 'published', templateId: 'pressed-garden', templateVersion: 1, revision: 1,
    content: content('forever'), publishedAt: new Ts(T0), updatedAt: new Ts(T0), schemaVersion: 2,
  });
  const published = await S.getPublicGift(h.env, 'abc234def567');
  assert.ok(published.ok && 'publicGift' in published);
  if (!published.ok || !('publicGift' in published)) return;
  assert.equal(published.publicGift!.content.fields.message, 'forever');
  h.advance(90 * DAY_MS);
  const stillPublished = await S.getPublicGift(h.env, 'abc234def567');
  assert.ok(stillPublished.ok && 'publicGift' in stillPublished);
  if (!stillPublished.ok || !('publicGift' in stillPublished)) return;
  assert.equal(stillPublished.publicGift!.status, 'published');
  assert.deepEqual(await S.getPublicGift(h.env, 'not-a-valid-slug'), { ok: false, status: 404, code: 'gift_not_found', detail: undefined });
});

/** Orders reach proof_submitted only after the (not yet built) proof upload; tests set it as a fixture. */
async function buy(h: ReturnType<typeof makeEnv>, actor: S.Actor, pkg: 'basic' | 'plus' | 'premium') {
  const o = await S.createOrder(h.env, actor, pkg);
  assert.ok(o.ok);
  h.store.docs.set(`orders/${o.orderId}`, { ...h.store.docs.get(`orders/${o.orderId}`)!, status: 'proof_submitted' });
  const a = await S.approveOrder(h.env, admin, o.orderId);
  assert.ok(a.ok);
  return { orderId: o.orderId, subscriptionId: a.subscriptionId };
}

test('payment: order uses server price; cannot be approved before proof, by a non-admin, or twice', async () => {
  const h = makeEnv(T0);
  const o = await S.createOrder(h.env, alice, 'plus');
  assert.ok(o.ok && o.amountIdr === 39000);
  assert.deepEqual(await S.createOrder(h.env, alice, 'gold'), { ok: false, status: 400, code: 'unknown_package', detail: undefined });
  const early = await S.approveOrder(h.env, admin, o.orderId);
  assert.deepEqual([early.ok, !early.ok && early.code], [false, 'order_not_reviewable']);
  h.store.docs.set(`orders/${o.orderId}`, { ...h.store.docs.get(`orders/${o.orderId}`)!, status: 'proof_submitted' });
  const byUser = await S.approveOrder(h.env, alice, o.orderId);
  assert.deepEqual([byUser.ok, !byUser.ok && byUser.code], [false, 'admin_required']);
  assert.equal([...h.store.docs.keys()].some((k) => k.startsWith('subscriptions/')), false);
  const first = await S.approveOrder(h.env, admin, o.orderId);
  assert.ok(first.ok && first.expiresAtMs === T0 + 14 * DAY_MS);
  const again = await S.approveOrder(h.env, admin, o.orderId);
  assert.deepEqual([again.ok, !again.ok && again.code], [false, 'order_not_reviewable']);
  assert.equal([...h.store.docs.keys()].filter((k) => k.startsWith('subscriptions/')).length, 1);
});

test('payment: a frozen snapshot, not later package edits, decides the duration', async () => {
  const h = makeEnv(T0);
  const o = await S.createOrder(h.env, alice, 'basic');
  assert.ok(o.ok);
  h.store.docs.set('packages/basic', { id: 'basic', name: 'Basic', priceIdr: 1, durationDays: 99, active: true, sortOrder: 1, limits: {} });
  h.store.docs.set(`orders/${o.orderId}`, { ...h.store.docs.get(`orders/${o.orderId}`)!, status: 'proof_submitted' });
  const a = await S.approveOrder(h.env, admin, o.orderId);
  assert.ok(a.ok && a.expiresAtMs === T0 + 3 * DAY_MS);
});

test('open-order cap and inactive packages', async () => {
  const h = makeEnv(T0);
  for (let i = 0; i < 3; i++) assert.ok((await S.createOrder(h.env, alice, 'basic')).ok);
  const r = await S.createOrder(h.env, alice, 'basic');
  assert.deepEqual([r.ok, !r.ok && r.code], [false, 'too_many_open_orders']);
  h.store.docs.set('packages/plus', { active: false, name: 'Plus', priceIdr: 39000, durationDays: 14, limits: {} });
  const r2 = await S.createOrder(h.env, mallory, 'plus');
  assert.deepEqual([r2.ok, !r2.ok && r2.code], [false, 'package_unavailable']);
});

test('creating a gift needs an active package, a known template, tier access and quota', async () => {
  const h = makeEnv(T0);
  const none = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.deepEqual([none.ok, !none.ok && none.code], [false, 'no_subscription']);
  await buy(h, alice, 'basic');
  const unknown = await S.createGift(h.env, alice, { templateId: 'nope', content: content() }, lookup);
  assert.deepEqual([unknown.ok, !unknown.ok && unknown.code], [false, 'unknown_template']);
  const tier = await S.createGift(h.env, alice, { templateId: 'our-little-archive', content: content() }, lookup);
  assert.deepEqual([tier.ok, !tier.ok && tier.code], [false, 'template_not_in_package']);
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.ok(g.ok);
  const second = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.deepEqual([second.ok, !second.ok && second.code], [false, 'quota_reached']);
});

test('deleting a gift does not free quota under the same subscription', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.ok(g.ok);
  assert.ok((await S.deleteGift(h.env, alice, g.giftId)).ok);
  const again = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.deepEqual([again.ok, !again.ok && again.code], [false, 'quota_reached']);
});

test('content validation: media rejected while upload is unavailable; oversize and bad keys rejected', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'premium');
  const withMedia = { ...content(), media: [{ id: 'a', kind: 'image', path: 'private/alice/gifts/x/a.jpg' }] };
  const r = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: withMedia }, lookup);
  assert.deepEqual([r.ok, !r.ok && r.code], [false, 'media_unavailable']);
  for (const badContent of [{ ...content(), fields: JSON.parse('{"__proto__":"x"}') }, { ...content(), data: { a: 'x'.repeat(5000) } }, { ...content(), sections: 'Opening' }, null, 'str']) {
    const x = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: badContent }, lookup);
    assert.deepEqual([x.ok, !x.ok && x.code], [false, 'invalid_content']);
  }
});

test('draft saves use optimistic concurrency and never touch the public document', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content('v1') }, lookup);
  assert.ok(g.ok);
  assert.ok((await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 })).ok);
  const pubBefore = h.store.docs.get(`publicGifts/${g.slug}`)!;
  const s = await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: content('v2 draft') }, lookup);
  assert.ok(s.ok && s.version === 2);
  const stale = await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: content('x') }, lookup);
  assert.deepEqual([stale.ok, !stale.ok && stale.code], [false, 'version_conflict']);
  assert.deepEqual(h.store.docs.get(`publicGifts/${g.slug}`), pubBefore);
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.content.fields.message, 'v1');
});

test('publish: public doc exposes no private data; publishing a stale version is refused; updates keep the slug', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content('first') }, lookup);
  assert.ok(g.ok);
  const stalePub = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 7 });
  assert.deepEqual([stalePub.ok, !stalePub.ok && stalePub.code], [false, 'version_conflict']);
  assert.equal(h.store.docs.has(`publicGifts/${g.slug}`), false);

  const p1 = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  assert.ok(p1.ok && p1.revision === 1 && p1.slug === g.slug);
  const pub = h.store.docs.get(`publicGifts/${g.slug}`)!;
  assert.deepEqual(Object.keys(pub).sort(), ['content', 'publishedAt', 'revision', 'schemaVersion', 'slug', 'status', 'templateId', 'templateVersion', 'updatedAt']);
  assert.ok(!JSON.stringify(pub).includes('alice'));
  assert.ok(h.store.docs.has(`gifts/${g.giftId}/revisions/1`));

  const s = await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: content('second') }, lookup);
  assert.ok(s.ok);
  const p2 = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 2 });
  assert.ok(p2.ok && p2.revision === 2 && p2.slug === g.slug);
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.content.fields.message, 'second');
  assert.ok(h.store.docs.has(`gifts/${g.giftId}/revisions/1`), 'old revision is kept');
});

test('MODEL B end to end: publish, expire, blocked edits, public gift untouched, renew, edit again, same URL', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content('forever') }, lookup);
  assert.ok(g.ok);
  assert.ok((await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 })).ok);
  const publicSnapshot = JSON.stringify(h.store.docs.get(`publicGifts/${g.slug}`));

  h.advance(10 * DAY_MS); // Basic lasted 3 days
  const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);
  assert.equal(code(await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: content('late') }, lookup)), 'subscription_expired');
  assert.equal(code(await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 })), 'subscription_expired');
  assert.equal(code(await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup)), 'subscription_expired');
  assert.equal(JSON.stringify(h.store.docs.get(`publicGifts/${g.slug}`)), publicSnapshot, 'public gift unchanged');
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.status, 'published');

  await buy(h, alice, 'plus'); // renewal
  const edit = await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: content('renewed') }, lookup);
  assert.ok(edit.ok);
  const pub = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 2 });
  assert.ok(pub.ok && pub.slug === g.slug);
  assert.equal([...h.store.docs.keys()].filter((k) => /^gifts\/[^/]+$/.test(k)).length, 1, 'no duplicate gift records');
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.content.fields.message, 'renewed');
});

test('expired owner can still archive/delete but cannot restore; archive hides, restore re-shows', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.ok(g.ok);
  await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  h.advance(5 * DAY_MS);
  assert.ok((await S.archiveGift(h.env, alice, g.giftId)).ok);
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.status, 'archived');
  const r = await S.unarchiveGift(h.env, alice, g.giftId);
  assert.deepEqual([r.ok, !r.ok && r.code], [false, 'subscription_expired']);
  await buy(h, alice, 'basic');
  assert.ok((await S.unarchiveGift(h.env, alice, g.giftId)).ok);
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.status, 'published');
});

test('delete leaves an empty tombstone, keeps the slug reserved, and cannot be republished', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'premium');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content('private words') }, lookup);
  assert.ok(g.ok);
  await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  assert.ok((await S.deleteGift(h.env, alice, g.giftId)).ok);
  const pub = h.store.docs.get(`publicGifts/${g.slug}`)!;
  assert.equal(pub.status, 'removed');
  assert.ok(!JSON.stringify(pub).includes('private words'));
  assert.ok(h.store.docs.has(`slugs/${g.slug}`));
  const again = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  assert.deepEqual([again.ok, !again.ok && again.code], [false, 'gift_deleted']);
});

test('policy removal by an admin cannot be undone by the owner republishing', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.ok(g.ok);
  await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  h.store.docs.set(`publicGifts/${g.slug}`, { ...h.store.docs.get(`publicGifts/${g.slug}`)!, status: 'removed' }); // fixture for the future moderation tool
  const r = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  assert.deepEqual([r.ok, !r.ok && r.code], [false, 'removed_by_policy']);
});

test('cross-user attacks: no editing, publishing, archiving, deleting or restoring another user\'s gift', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic'); await buy(h, mallory, 'premium');
  const g = await S.createGift(h.env, alice, { templateId: 'pressed-garden', content: content() }, lookup);
  assert.ok(g.ok);
  await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 });
  const results = [
    await S.saveDraft(h.env, mallory, g.giftId, { expectedVersion: 1, content: content('pwned') }, lookup),
    await S.publishGift(h.env, mallory, g.giftId, { expectedVersion: 1 }),
    await S.archiveGift(h.env, mallory, g.giftId),
    await S.deleteGift(h.env, mallory, g.giftId),
    await S.unarchiveGift(h.env, mallory, g.giftId),
  ];
  for (const r of results) assert.deepEqual([r.ok, !r.ok && r.status], [false, 403]);
  assert.equal(h.store.docs.get(`publicGifts/${g.slug}`)!.status, 'published');
  const missing = await S.saveDraft(h.env, alice, 'nope', { expectedVersion: 1, content: content() }, lookup);
  assert.deepEqual([missing.ok, !missing.ok && missing.status], [false, 404]);
});

test('legacy ISO-string draft is upgraded in place on first save without losing legacy fields', async () => {
  const h = makeEnv(T0);
  await buy(h, alice, 'basic');
  h.store.docs.set('gifts/legacy1', { ownerUid: 'alice', title: 'Old', recipientName: 'Sam', message: 'm', scenes: ['Opening'], status: 'draft', updatedAt: '2026-10-01T00:00:00.000Z' });
  const noTpl = await S.saveDraft(h.env, alice, 'legacy1', { expectedVersion: 1, content: content('new') }, lookup);
  assert.deepEqual([noTpl.ok, !noTpl.ok && noTpl.code], [false, 'template_required']);
  const wrongTier = await S.saveDraft(h.env, alice, 'legacy1', { expectedVersion: 1, content: content('new'), templateId: 'our-little-archive' }, lookup);
  assert.deepEqual([wrongTier.ok, !wrongTier.ok && wrongTier.code], [false, 'template_not_in_package']);
  const ok = await S.saveDraft(h.env, alice, 'legacy1', { expectedVersion: 1, content: content('new'), templateId: 'pressed-garden' }, lookup);
  assert.ok(ok.ok && ok.version === 2);
  const doc = h.store.docs.get('gifts/legacy1')!;
  assert.equal(doc.schemaVersion, 2);
  assert.ok(doc.updatedAt instanceof Ts);
  assert.equal(doc.title, 'Old', 'legacy field preserved');
  assert.equal(doc.templateId, 'pressed-garden');
});

test('fake store enforces reads-before-writes and atomic rollback (guards the harness itself)', async () => {
  const h = makeEnv(T0);
  await assert.rejects(h.store.runTransaction(async (tx) => { tx.set('a/1', {}); await tx.get('a/1'); }));
  await assert.rejects(h.store.runTransaction(async (tx) => { tx.set('a/2', {}); tx.create('a/2', {}); }));
  assert.equal(h.store.docs.has('a/2'), false);
});
