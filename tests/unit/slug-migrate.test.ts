import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSlug, isValidSlug, SLUG_LENGTH } from '../../lib/slug.ts';
import { toMillis, planLegacyGiftMigration } from '../../lib/model/migrate.ts';

test('slugs are valid, correct length and non-repeating across many draws', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i++) {
    const s = generateSlug();
    assert.equal(s.length, SLUG_LENGTH);
    assert.equal(isValidSlug(s), true);
    seen.add(s);
  }
  assert.equal(seen.size, 5000);
});

test('slug generation has no modulo bias artifacts and skips out-of-range bytes', () => {
  // Bytes >= 248 must be rejected; feed them first and expect them to be skipped.
  const bytes = [255, 250, 248, ...Array(200).fill(0)];
  const s = generateSlug((n) => Uint8Array.from(bytes.slice(0, n).concat(Array(Math.max(0, n - bytes.length)).fill(0))));
  assert.equal(s, 'a'.repeat(SLUG_LENGTH));
});

test('slug validator rejects reserved, wrong length, ambiguous and path-like input', () => {
  for (const bad of ['demo', '', 'short', 'ABCDEFGHJKMN', 'abcdefghjkm0', '../abcdefghij', 'abcdefghjkmnp', 42, null]) {
    assert.equal(isValidSlug(bad), false, String(bad));
  }
});

test('toMillis handles ISO strings, Timestamp-likes, Dates and garbage', () => {
  assert.equal(toMillis('2026-10-30T05:02:00.000Z'), Date.UTC(2026, 9, 30, 5, 2));
  assert.equal(toMillis({ toMillis: () => 5 }), 5);
  assert.equal(toMillis({ seconds: 2, nanoseconds: 500_000_000 }), 2500);
  assert.equal(toMillis({ _seconds: 3, _nanoseconds: 0 }), 3000);
  assert.equal(toMillis(new Date(7)), 7);
  assert.equal(toMillis('not a date'), null);
  assert.equal(toMillis(undefined), null);
});

const mk = (ms: number) => ({ ms });

test('legacy draft migrates additively and converts ISO strings', () => {
  const legacy = { ownerUid: 'u1', title: 'Hi', recipientName: 'Sam', message: 'Thanks', scenes: ['Opening', 'Letter'], status: 'draft', updatedAt: '2026-10-01T00:00:00.000Z' };
  const plan = planLegacyGiftMigration(legacy, mk, 999);
  assert.equal(plan.action, 'migrate');
  if (plan.action !== 'migrate') return;
  assert.deepEqual(plan.patch.updatedAt, { ms: Date.UTC(2026, 9, 1) });
  assert.deepEqual(plan.patch.createdAt, { ms: Date.UTC(2026, 9, 1) });
  assert.equal(plan.patch.templateId, null);
  assert.equal(plan.needsTemplateChoice, true);
  assert.deepEqual(plan.patch.draft.content.fields, { title: 'Hi', recipientName: 'Sam', message: 'Thanks' });
  assert.deepEqual(plan.patch.draft.content.sections, ['Opening', 'Letter']);
  assert.equal(plan.patch.schemaVersion, 2);
  // Additive: the patch never mentions legacy field names, so merge keeps them.
  for (const k of ['title', 'recipientName', 'message', 'scenes', 'ownerUid']) assert.equal(k in plan.patch, false);
});

test('migration is idempotent and rejects unusable docs', () => {
  assert.deepEqual(planLegacyGiftMigration({ schemaVersion: 2, ownerUid: 'u' }, mk, 1), { action: 'skip', reason: 'already_v2' });
  assert.deepEqual(planLegacyGiftMigration({ title: 'x' }, mk, 1), { action: 'invalid', reason: 'missing_owner' });
  assert.deepEqual(planLegacyGiftMigration({ ownerUid: 'u', status: 'weird' }, mk, 1), { action: 'invalid', reason: 'bad_status' });
});

test('a legacy "published" doc is demoted to draft and flagged, never given a fake public URL', () => {
  const plan = planLegacyGiftMigration({ ownerUid: 'u', status: 'published', templateId: 'pressed-garden' }, mk, 1);
  assert.equal(plan.action, 'migrate');
  if (plan.action !== 'migrate') return;
  assert.equal(plan.patch.status, 'draft');
  assert.equal(plan.legacyPublished, true);
  assert.equal(plan.needsTemplateChoice, false);
  assert.equal(plan.patch.publishedRevision, null);
});
