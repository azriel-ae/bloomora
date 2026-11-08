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

test('valid MP3 remains uploadable when a browser omits its MIME type', () => {
  const mp3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  assert.deepEqual(validateMediaFile('audio', '', mp3, 'kenangan.mp3'), { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3', name: 'kenangan.mp3' });
  assert.deepEqual(validateMediaFile('audio', 'application/octet-stream', mp3, 'kenangan.mp3').mime, 'audio/mpeg');
  assert.throws(() => validateMediaFile('audio', '', mp3, 'kenangan.txt'), /invalid_media_type/);
});

test('storage permission failures are returned instead of escaping as an unknown server error', async () => {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created); if (!created.ok) return;
  const storage = { storage: { from: () => ({ upload: async () => ({ error: { statusCode: 403, message: 'permission denied' } }), createSignedUrl: async () => ({ data: null, error: null }), remove: async () => ({ error: null }) }) } };
  const result = await uploadGuestMedia(h.env, storage, created.giftId, created.editToken, { kind: 'audio', expectedVersion: 1, bytes: new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]), mime: '', fileName: 'kenangan.mp3' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'media_storage_forbidden');
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

// ---- Direct-to-Storage audio upload and real error causes -------------------------------------------
const direct = await import('../../lib/server/media-direct.ts');
const services = await import('../../lib/server/media-services.ts');
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]);

function memoryStorage(opts: { objects?: Map<string, Uint8Array>; signedUploadError?: unknown } = {}) {
  const objects = opts.objects ?? new Map<string, Uint8Array>();
  const removed: string[] = [];
  const bucket = {
    upload: async (path: string, body: Uint8Array) => { objects.set(path, body); return { error: null }; },
    createSignedUploadUrl: async (path: string) => opts.signedUploadError ? { data: null, error: opts.signedUploadError } : { data: { signedUrl: `https://x/upload/${path}`, token: 'tok', path }, error: null },
    createSignedUrl: async (path: string) => objects.has(path) ? { data: { signedUrl: `https://x/read/${path}` }, error: null } : { data: null, error: { statusCode: '404', message: 'Object not found' } },
    remove: async (paths: string[]) => { for (const p of paths) { objects.delete(p); removed.push(p); } return { error: null }; },
  };
  return { storage: { storage: { from: () => bucket } }, objects, removed };
}
const readFrom = (objects: Map<string, Uint8Array>) => async (url: string) => {
  const path = url.replace('https://x/read/', '');
  const bytes = objects.get(path);
  if (!bytes) throw new ServiceError(409, 'media_object_missing');
  return { bytes: bytes.slice(0, 64), total: bytes.byteLength };
};
async function newDraft() {
  const h = makeEnv(Date.UTC(2026, 10, 1));
  const created = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(created.ok); if (!created.ok) throw new Error('draft');
  return { h, created };
}

test('Storage errors keep their real cause instead of a generic failure', () => {
  assert.equal(services.classifyStorageError({ statusCode: '404', message: 'Bucket not found' }).code, 'media_bucket_missing');
  assert.equal(services.classifyStorageError({ statusCode: '415', message: 'mime type audio/mpeg is not supported' }).code, 'media_storage_mime_rejected');
  assert.equal(services.classifyStorageError({ statusCode: '413', message: 'The object exceeded the maximum allowed size' }).code, 'media_storage_too_large');
  assert.equal(services.classifyStorageError({ statusCode: '403', message: 'new row violates row-level security policy' }).code, 'media_storage_forbidden');
  assert.equal(services.classifyStorageError(new Error('request timed out')).code, 'media_storage_timeout');
  assert.equal(services.classifyServerError({ code: '42P01', message: 'relation "public.gift_media" does not exist' }).code, 'media_database_schema_missing');
  assert.equal(services.classifyServerError({ code: '23514', message: 'violates check constraint' }).code, 'media_database_failed');
  const leaked = services.sanitizeErrorDetail(new Error('connect postgresql://u:p@db.example.com/x token=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu'));
  assert.ok(!/postgresql:\/\/|abcdefghijklmnop/.test(leaked));
});

test('direct MP3 upload: init is authorized, object is verified, and the reference is committed', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage();
  const denied = await direct.initDirectUpload(h.env, s.storage, created.giftId, 'wrong-token', { kind: 'audio', mime: 'audio/mpeg', fileName: 'lagu.mp3', size: 8_000_000, expectedVersion: 1 });
  assert.equal(denied.ok, false);
  const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'lagu.mp3', size: 8_000_000, expectedVersion: 1 });
  assert.ok(init.ok); if (!init.ok) return;
  assert.equal(init.path, `private/${created.giftId}/${init.mediaId}.mp3`);
  await s.storage.storage.from().upload(init.path, MP3);
  const done = await direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'lagu.mp3', expectedVersion: 1 }, readFrom(s.objects));
  assert.ok(done.ok); if (!done.ok) return;
  assert.equal(done.version, 2);
  assert.equal(done.media.name, 'lagu.mp3');
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media[0].path, init.path);
  assert.equal(h.store.docs.get(`giftMedia/${init.mediaId}`)?.contentType, 'audio/mpeg');
  assert.equal(h.store.docs.get(`giftMedia/${init.mediaId}`)?.sizeBytes, MP3.byteLength);
});

test('a retried complete is idempotent and a failed commit leaves no duplicate or broken reference', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage();
  const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'lagu.mp3', size: 100, expectedVersion: 1 });
  assert.ok(init.ok); if (!init.ok) return;
  s.objects.set(init.path, MP3);
  const body = { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'lagu.mp3', expectedVersion: 1 };
  // The database write fails once (after Storage already holds the file).
  const original = h.store.runTransaction.bind(h.store);
  let calls = 0;
  h.store.runTransaction = async (fn) => { calls++; if (calls === 3) throw Object.assign(new Error('connection terminated'), { code: '08006' }); return original(fn); };
  await assert.rejects(direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, body, readFrom(s.objects)));
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media.length, 0);
  assert.equal(s.objects.has(init.path), true, 'object is kept so the retry can finish');
  h.store.runTransaction = original;
  const retry = await direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, body, readFrom(s.objects));
  assert.ok(retry.ok);
  const again = await direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, body, readFrom(s.objects));
  assert.ok(again.ok); if (again.ok) assert.equal((again as { alreadyCommitted?: boolean }).alreadyCommitted, true);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media.length, 1);
  assert.equal([...h.store.docs.keys()].filter((k) => k.startsWith('giftMedia/')).length, 1);
});

test('complete rejects and removes a stored object whose bytes are not the declared MP3', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage();
  const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'x.mp3', size: 10, expectedVersion: 1 });
  assert.ok(init.ok); if (!init.ok) return;
  s.objects.set(init.path, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  const done = await direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'x.mp3', expectedVersion: 1 }, readFrom(s.objects));
  assert.equal(done.ok, false); if (!done.ok) assert.equal(done.code, 'media_signature_mismatch');
  assert.equal(s.objects.has(init.path), false);
  assert.equal(h.store.docs.get(`gifts/${created.giftId}`)?.draft.content.media.length, 0);
});

test('complete cannot reference another gift\'s object and a missing object reports media_object_missing', async () => {
  const { h, created: a } = await newDraft();
  const b = await guest.createGuestGift(h.env, { templateId: 'chapter-of-us', content: sampleContent(chapterOfUs, 'en') }, lookupTemplate);
  assert.ok(b.ok); if (!b.ok) return;
  assert.notEqual(a.giftId, b.giftId);
  const s = memoryStorage();
  const init = await direct.initDirectUpload(h.env, s.storage, a.giftId, a.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'a.mp3', size: 10, expectedVersion: 1 });
  assert.ok(init.ok); if (!init.ok) return;
  s.objects.set(init.path, MP3);
  // Gift B's token cannot finalize gift A's media id, and paths are always derived from the URL's own gift id.
  const cross = await direct.completeDirectUpload(h.env, s.storage, b.giftId, b.editToken, { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'a.mp3', expectedVersion: 1 }, readFrom(s.objects));
  assert.equal(cross.ok, false); if (!cross.ok) assert.equal(cross.code, 'media_object_missing');
  assert.equal(h.store.docs.get(`gifts/${b.giftId}`)?.draft.content.media.length, 0);
  const wrongToken = await direct.completeDirectUpload(h.env, s.storage, a.giftId, b.editToken, { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'a.mp3', expectedVersion: 1 }, readFrom(s.objects));
  assert.equal(wrongToken.ok, false);
});

test('init surfaces a missing bucket instead of a generic server error', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage({ signedUploadError: { statusCode: '404', message: 'Bucket not found' } });
  const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'a.mp3', size: 10, expectedVersion: 1 });
  assert.equal(init.ok, false); if (!init.ok) { assert.equal(init.code, 'media_bucket_missing'); assert.match(String(init.detail), /Bucket not found/); }
});

test('init repairs a bucket that rejects audio and never makes it public', async () => {
  const { h, created } = await newDraft();
  direct.resetBucketCheckForTests();
  const s = memoryStorage();
  const calls: { op: string; options?: Record<string, unknown> }[] = [];
  Object.assign(s.storage.storage, {
    getBucket: async () => ({ data: { public: false, file_size_limit: 5_242_880, allowed_mime_types: ['image/jpeg'] }, error: null }),
    updateBucket: async (_id: string, options: Record<string, unknown>) => { calls.push({ op: 'update', options }); return { error: null }; },
    createBucket: async () => { calls.push({ op: 'create' }); return { error: null }; },
  });
  const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'a.mp3', size: 10, expectedVersion: 1 });
  assert.ok(init.ok);
  assert.equal(calls.length, 1); assert.equal(calls[0].op, 'update');
  assert.equal(calls[0].options?.public, false);
  assert.ok((calls[0].options?.allowedMimeTypes as string[]).includes('audio/mpeg'));
  direct.resetBucketCheckForTests();
});

test('replacing music: delete then upload again works, and a published gift keeps its audio object', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage();
  const up = async (version: number) => {
    const init = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'baru.mp3', size: 10, expectedVersion: version });
    assert.ok(init.ok); if (!init.ok) throw new Error('init');
    s.objects.set(init.path, MP3);
    const done = await direct.completeDirectUpload(h.env, s.storage, created.giftId, created.editToken, { mediaId: init.mediaId, kind: 'audio', mime: 'audio/mpeg', fileName: 'baru.mp3', expectedVersion: version }, readFrom(s.objects));
    assert.ok(done.ok); if (!done.ok) throw new Error('complete');
    return { id: init.mediaId, path: init.path, version: done.version };
  };
  const first = await up(1);
  const second = await direct.initDirectUpload(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', mime: 'audio/mpeg', fileName: 'b.mp3', size: 10, expectedVersion: first.version });
  assert.equal(second.ok, false); if (!second.ok) assert.equal(second.code, 'guest_audio_limit');
  const del = await deleteGuestMedia(h.env, s.storage, created.giftId, created.editToken, { mediaId: first.id, expectedVersion: first.version });
  assert.ok(del.ok); if (!del.ok) return;
  assert.equal(s.objects.has(first.path), false);
  const replacement = await up(del.version);
  assert.notEqual(replacement.path, first.path);
  // A published gift may still serve the old revision: deleting a draft reference must keep the object.
  const gift = h.store.docs.get(`gifts/${created.giftId}`)!;
  h.store.docs.set(`gifts/${created.giftId}`, { ...gift, publishedRevision: 1 });
  const del2 = await deleteGuestMedia(h.env, s.storage, created.giftId, created.editToken, { mediaId: replacement.id, expectedVersion: replacement.version });
  assert.ok(del2.ok);
  assert.equal(s.objects.has(replacement.path), true);
});

test('one unsignable object does not hide the other media URLs', async () => {
  const { h, created } = await newDraft();
  const s = memoryStorage();
  const img = await uploadGuestMedia(h.env, s.storage, created.giftId, created.editToken, { kind: 'image', expectedVersion: 1, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]), mime: 'image/jpeg' });
  assert.ok(img.ok); if (!img.ok) return;
  const aud = await uploadGuestMedia(h.env, s.storage, created.giftId, created.editToken, { kind: 'audio', expectedVersion: img.version, bytes: MP3, mime: 'audio/mpeg', fileName: 'x.mp3' });
  assert.ok(aud.ok); if (!aud.ok) return;
  s.objects.delete(aud.media.path);
  const urls = await getGuestMediaUrls(h.env, s.storage, created.giftId, created.editToken);
  assert.ok(urls.ok); if (urls.ok) { assert.ok(urls.mediaUrls[img.media.id]); assert.equal(urls.mediaUrls[aud.media.id], undefined); }
});
