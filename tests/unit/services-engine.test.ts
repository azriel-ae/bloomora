import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './helpers/fake-store.ts';
import * as S from '../../lib/server/services.ts';
import { createTemplateLookup, lookupTemplate } from '../../lib/server/template-lookup.ts';
import { createRegistry, ALL_TEMPLATE_VERSIONS } from '../../lib/engine/registry.ts';
import { blankContent, sampleContent } from '../../lib/engine/resolve.ts';
import { chapterOfUs } from '../../lib/engine/templates/chapter-of-us.ts';
import { contrastRatio } from '../../lib/engine/color.ts';

const T0 = Date.UTC(2026, 10, 1);
const alice: S.Actor = { uid: 'alice', admin: false };
const admin: S.Actor = { uid: 'root', admin: true };
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);

async function buy(h: ReturnType<typeof makeEnv>, pkg: 'basic' | 'plus') {
  const o = await S.createOrder(h.env, alice, pkg); assert.ok(o.ok);
  h.store.docs.set(`orders/${o.orderId}`, { ...h.store.docs.get(`orders/${o.orderId}`)!, status: 'proof_submitted' }); // fixture: proof upload not built yet
  assert.ok((await S.approveOrder(h.env, admin, o.orderId)).ok);
}

test('palette numbers (sanity: the gate is measuring something real)', () => {
  const p = chapterOfUs.theme.palette;
  const r = (a: string, b: string) => Math.round(contrastRatio(a, b) * 10) / 10;
  console.log('chapter-of-us contrast: ink/bg', r(p.ink, p.background), 'muted/bg', r(p.mutedInk, p.background), 'accentInk/accent', r(p.accentInk, p.accent), 'accent/bg', r(p.accent, p.background));
  assert.ok(contrastRatio(p.ink, p.background) >= 7);
  assert.ok(contrastRatio('#9a8f88', p.background) < 4.5, 'a pale grey would have been rejected');
});

test('the featured template (tier core) is usable on Basic; an extended template is not', async () => {
  const h = makeEnv(T0); await buy(h, 'basic');
  const blocked = await S.createGift(h.env, alice, { templateId: 'our-little-archive', content: blankContent(ALL_TEMPLATE_VERSIONS[2]) }, lookupTemplate);
  assert.equal(code(blocked), 'template_not_in_package');
  const ok = await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: blankContent(chapterOfUs) }, lookupTemplate);
  assert.ok(ok.ok);
});

test('server rejects content that does not belong to the template', async () => {
  const h = makeEnv(T0); await buy(h, 'basic');
  const sample = sampleContent(chapterOfUs, 'en');
  assert.equal(code(await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: { ...sample, fields: { ...sample.fields, injected: 'x' } } }, lookupTemplate)), 'invalid_content');
  assert.equal(code(await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: { ...sample, sections: [...sample.sections].reverse() } }, lookupTemplate)), 'invalid_content');
  const g = await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: blankContent(chapterOfUs) }, lookupTemplate);
  assert.ok(g.ok);
  assert.equal(code(await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: { ...sample, data: { ...sample.data, ghost: [] } } }, lookupTemplate)), 'invalid_content');
});

test('publish refuses an incomplete draft and lists what is missing; a complete one publishes exactly', async () => {
  const h = makeEnv(T0); await buy(h, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: blankContent(chapterOfUs) }, lookupTemplate);
  assert.ok(g.ok);
  const early = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 1 }, lookupTemplate);
  assert.ok(!early.ok && early.code === 'incomplete_content' && early.status === 422);
  assert.ok(early.detail!.includes('letterBody') && early.detail!.includes('chapters'));
  assert.equal(h.store.docs.has(`publicGifts/${g.slug}`), false);

  const full = sampleContent(chapterOfUs, 'id');
  assert.ok((await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: full }, lookupTemplate)).ok);
  const pub = await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 2 }, lookupTemplate);
  assert.ok(pub.ok);
  const doc = h.store.docs.get(`publicGifts/${g.slug}`)!;
  assert.equal(doc.templateId, 'chapter-of-us'); assert.equal(doc.templateVersion, 1);
  assert.equal(doc.content.fields.title, 'Tiga Tahun, Satu Cerita');
});

test('MODEL B + engine: a gift keeps being editable/publishable against its pinned version after the template is retired', async () => {
  const h = makeEnv(T0); await buy(h, 'basic');
  const g = await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(g.ok);
  const retired = { ...chapterOfUs, status: 'inactive' as const, hasDemo: false, featured: false };
  const retiredLookup = createTemplateLookup(createRegistry([retired]));
  assert.equal(code(await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content: blankContent(chapterOfUs) }, retiredLookup)), 'unknown_template');
  assert.ok((await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 1, content: sampleContent(chapterOfUs, 'id') }, retiredLookup)).ok);
  assert.ok((await S.publishGift(h.env, alice, g.giftId, { expectedVersion: 2 }, retiredLookup)).ok);
  const gone = createTemplateLookup(createRegistry([]));
  assert.equal(code(await S.saveDraft(h.env, alice, g.giftId, { expectedVersion: 2, content: sampleContent(chapterOfUs, 'en') }, gone)), 'template_unavailable');
});

test('private draft read is owner-only and still returns read-only content after entitlement expires', async () => {
  const h = makeEnv(T0); await buy(h, 'basic');
  const content = sampleContent(chapterOfUs, 'id');
  const created = await S.createGift(h.env, alice, { templateId: 'chapter-of-us', content }, lookupTemplate);
  assert.ok(created.ok);

  const readable = await S.getGiftDraft(h.env, alice, created.giftId);
  assert.ok(readable.ok);
  assert.equal(readable.editable, true);
  assert.deepEqual(readable.draft.content, content);
  assert.equal(readable.draft.version, 1);

  h.advance(4 * 86_400_000);
  const expired = await S.getGiftDraft(h.env, alice, created.giftId);
  assert.ok(expired.ok);
  assert.equal(expired.editable, false);
  assert.equal(expired.reason, 'subscription_expired');
  assert.deepEqual(expired.draft.content, content);

  const stranger = await S.getGiftDraft(h.env, { uid: 'mallory', admin: false }, created.giftId);
  assert.ok(!stranger.ok && stranger.code === 'not_owner');
});
