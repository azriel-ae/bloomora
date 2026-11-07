import assert from 'node:assert/strict';
import test from 'node:test';
import { makeEnv } from './helpers/fake-store.ts';
import { ServiceError } from '../../lib/server/store.ts';
import { guestOwnerId } from '../../lib/security/edit-token.ts';
import { sampleContent } from '../../lib/engine/resolve.ts';
import { chapterOfUs } from '../../lib/engine/templates/chapter-of-us.ts';
import { lookupTemplate } from '../../lib/server/template-lookup.ts';
process.env.NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED = 'true';
const { validateMediaFile, uploadGuestMedia, getGuestMediaUrls, deleteGuestMedia, MAX_MEDIA_BYTES } = await import('../../lib/server/media-services.ts');
const guest = await import('../../lib/server/guest-services.ts');

test('media accepts only allowed kind/type/signature and bounded size', () => {
  assert.deepEqual(validateMediaFile('image', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0])).ext, 'jpg');
  assert.throws(() => validateMediaFile('image', 'image/jpeg', new Uint8Array([1, 2, 3])), /media_signature_mismatch/);
  assert.throws(() => validateMediaFile('image', 'image/svg+xml', new Uint8Array([1])), /invalid_media_type/);
  assert.throws(() => validateMediaFile('../image', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff])), /invalid_media_kind/);
  assert.throws(() => validateMediaFile('audio', 'audio/wav', new Uint8Array([1, 2])), /media_signature_mismatch/);
  assert.throws(() => validateMediaFile('image', 'image/png', new Uint8Array(MAX_MEDIA_BYTES + 1)), /invalid_media_size/);
});

test('upload rejects a bad edit token but allows an authorized guest draft before checkout', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  let uploadCalls = 0;
  const storage = { storage: { from: () => ({ upload: async () => { uploadCalls++; return { error: null }; }, createSignedUrl: async () => ({ data: { signedUrl: 'signed' }, error: null }), remove: async () => ({ error: null }) }) } };
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0]);
  const denied = await uploadGuestMedia(h.env, storage, created.giftId, 'wrong', { kind: 'image', expectedVersion: 1, bytes, mime: 'image/jpeg' });
  assert.equal(denied.ok, false); assert.equal(uploadCalls, 0);
  const guestUpload = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, { kind: 'image', expectedVersion: 1, bytes, mime: 'image/jpeg' });
  assert.equal(guestUpload.ok, true); assert.equal(uploadCalls, 1);
});

test('an unpaid guest can upload one audio file without a subscription', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  const storage = { storage: { from: () => ({
    upload: async () => ({ error: null }),
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `signed:${path}` }, error: null }),
    remove: async () => ({ error: null }),
  }) } };
  const result = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, {
    kind: 'audio', expectedVersion: 1, bytes: new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]), mime: 'audio/mpeg',
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.media.kind, 'audio');
  const second = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, {
    kind: 'audio', expectedVersion: result.ok ? result.version : 1, bytes: new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]), mime: 'audio/mpeg',
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, 'guest_audio_limit');
});

test('guest photo upload persists the private ref, metadata, draft version and a renewable signed URL', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  h.store.docs.set('subscriptions/sub1', { userId: guestOwnerId(created.editToken), status: 'active', startedAt: h.env.ts(Date.UTC(2026, 9, 1)), expiresAt: h.env.ts(Date.UTC(2026, 11, 1)), packageSnapshot: { packageId: 'premium', name: 'Premium', priceIdr: 1, durationDays: 30, limits: { maxGifts: 1, maxPhotos: 40, music: true, priorityReview: true, allowedTemplateTiers: ['core', 'extended'] } } });
  const storage = { storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async (path: string) => ({ data: { signedUrl: `signed:${path}` }, error: null }), remove: async () => ({ error: null }) }) } };
  const result = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, { kind: 'image', placement: 'hero', expectedVersion: 1, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]), mime: 'image/jpeg' });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.version, 2);
  assert.equal(result.media.placement, 'hero');
  assert.deepEqual([result.media.kind, result.media.path.startsWith(`private/${created.giftId}/`), result.signedUrl.startsWith('signed:')], ['image', true, true]);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media[0].id, result.media.id);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media[0].placement, 'hero');
  assert.equal(h.store.docs.get(`giftMedia/${result.media.id}`)?.storagePath, result.media.path);
  const refreshed = await getGuestMediaUrls(h.env, storage, created.giftId, created.editToken);
  assert.equal(refreshed.ok, true);
  if (refreshed.ok) assert.equal(refreshed.mediaUrls[result.media.id], `signed:${result.media.path}`);
});

test('uploaded object is removed if optimistic draft transaction fails', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  h.store.docs.set(`subscriptions/sub1`, { userId: guestOwnerId(created.editToken), status: 'active', startedAt: h.env.ts(Date.UTC(2026, 9, 1)), expiresAt: h.env.ts(Date.UTC(2026, 11, 1)), packageSnapshot: { packageId: 'premium', name: 'Premium', priceIdr: 1, durationDays: 30, limits: { maxGifts: 1, maxPhotos: 40, music: true, priorityReview: true, allowedTemplateTiers: ['core', 'extended'] } } });
  const original = h.store.runTransaction.bind(h.store);
  let runs = 0;
  h.store.runTransaction = async (fn) => { runs++; if (runs === 2) throw new ServiceError(409, 'version_conflict'); return original(fn); };
  let removed = false;
  const storage = { storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'signed' }, error: null }), remove: async () => { removed = true; return { error: null }; } }) } };
  const result = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, { kind: 'image', expectedVersion: 1, bytes: new Uint8Array([0xff, 0xd8, 0xff]), mime: 'image/jpeg' });
  assert.equal(result.ok, false);
  assert.equal(removed, true);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.version, 1);
});

test('authorized guest deletion removes draft reference, soft-deletes metadata, and removes unused object', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  const storage = { storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'signed' }, error: null }), remove: async (paths: string[]) => ({ error: paths.length === 1 ? null : new Error('unexpected') }) }) } };
  const uploaded = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, { kind: 'image', expectedVersion: 1, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]), mime: 'image/jpeg' });
  assert.ok(uploaded.ok); if (!uploaded.ok) return;
  const deleted = await deleteGuestMedia(h.env, storage, created.giftId, created.editToken, { mediaId: uploaded.media.id, expectedVersion: uploaded.version });
  assert.ok(deleted.ok);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media.length, 0);
  assert.ok(h.store.docs.get(`giftMedia/${uploaded.media.id}`)?.deletedAt);
});

test('guest deletion with a wrong token cannot modify the draft or storage metadata', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) return;
  const result = await deleteGuestMedia(h.env, { storage: { from: () => ({ remove: async () => ({ error: null }) }) } }, created.giftId, 'wrong-token', { mediaId: 'missing', expectedVersion: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'edit_link_invalid');
});
