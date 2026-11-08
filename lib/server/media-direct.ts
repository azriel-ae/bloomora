import { validateGiftContent } from '../model/content.ts';
import { loadGuestForMedia } from './guest-services.ts';
import { ServiceError, guarded, type Env } from './store.ts';
import {
  AUDIO_TYPES, IMAGE_TYPES, MAX_MEDIA_BYTES, MIME_BY_EXTENSION, bucketFor, checkUpload, mimeFromName, sanitizeErrorDetail,
  storageServiceError, validateMediaFile, type MediaBucket, type MediaKind, type MediaStorage, MEDIA_BUCKET,
} from './media-services.ts';

/**
 * Direct-to-Storage upload. A multipart request through a Vercel Function is capped near 4.5 MB, which
 * rejects most MP3 files before this server sees them. The server therefore authorizes the guest edit
 * link, validates the declared file, reserves an isolated path, and issues a one-shot signed upload URL.
 * The browser sends the bytes straight to the private bucket; `complete` then re-reads the stored object,
 * checks its real size and signature, and only then writes the metadata + draft reference.
 */
const MEDIA_ID = /^[A-Za-z0-9_-]{1,120}$/;
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a' };
const BUCKET_MIME = [...IMAGE_TYPES, ...AUDIO_TYPES];
let bucketReady = false;

export function mediaPath(giftId: string, mediaId: string, ext: string): string {
  return `private/${giftId}/${mediaId}.${ext}`;
}

/** Validate what the client declares (type, name, size) before any signature bytes exist. */
export function declareMedia(kind: unknown, mime: unknown, fileName: unknown, size: unknown): { kind: MediaKind; mime: string; ext: string; name?: string } {
  if (kind !== 'image' && kind !== 'audio') throw new ServiceError(400, 'invalid_media_kind');
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_MEDIA_BYTES) throw new ServiceError(413, 'invalid_media_size');
  const supplied = typeof mime === 'string' ? mime.toLowerCase().trim() : '';
  const normalized = supplied && supplied !== 'application/octet-stream' ? supplied : mimeFromName(fileName);
  if (!normalized || !(kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES).has(normalized)) throw new ServiceError(415, 'invalid_media_type');
  const ext = EXT_BY_MIME[normalized];
  const named = typeof fileName === 'string' ? fileName.toLowerCase().split('.').pop() ?? '' : '';
  if (named && MIME_BY_EXTENSION[named] && MIME_BY_EXTENSION[named] !== normalized && !(normalized === 'audio/x-m4a' && named === 'm4a')) throw new ServiceError(415, 'invalid_media_type');
  const safeName = typeof fileName === 'string' ? fileName.trim().replace(/[\u0000-\u001f\\/]+/g, '_').slice(0, 180) : '';
  return { kind, mime: normalized, ext, ...(safeName ? { name: safeName } : {}) };
}

/**
 * Make sure the private bucket exists and accepts audio. Uses only the server-side service-role client;
 * the bucket stays private and RLS is untouched. Mirrors supabase/migrations/20261104000100.
 */
export async function ensureMediaBucket(storage: MediaStorage): Promise<void> {
  if (bucketReady) return;
  const api = storage.storage;
  if (!api.getBucket || !api.createBucket || !api.updateBucket) return;
  const options = { public: false, fileSizeLimit: MAX_MEDIA_BYTES, allowedMimeTypes: BUCKET_MIME };
  const found = await api.getBucket(MEDIA_BUCKET);
  if (found.error || !found.data) {
    const created = await api.createBucket(MEDIA_BUCKET, options);
    if (created.error) throw storageServiceError(created.error);
    bucketReady = true;
    return;
  }
  const mimes = found.data.allowed_mime_types;
  const limit = found.data.file_size_limit;
  const mimeOk = mimes == null || BUCKET_MIME.every((type) => mimes.includes(type));
  const sizeOk = limit == null || limit >= MAX_MEDIA_BYTES;
  if (found.data.public === true || !mimeOk || !sizeOk) {
    const updated = await api.updateBucket(MEDIA_BUCKET, options);
    if (updated.error) throw storageServiceError(updated.error);
  }
  bucketReady = true;
}
export function resetBucketCheckForTests() { bucketReady = false; }

export function initDirectUpload(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { kind: unknown; mime: unknown; fileName?: unknown; size: unknown; placement?: unknown; expectedVersion: unknown }) {
  return guarded(async () => {
    const declared = declareMedia(input.kind, input.mime, input.fileName, input.size);
    if (input.placement !== undefined && (input.placement !== 'hero' || declared.kind !== 'image')) throw new ServiceError(400, 'invalid_media_placement');
    if (!Number.isInteger(input.expectedVersion)) throw new ServiceError(400, 'invalid_expected_version');
    await checkUpload(env, giftId, token, declared.kind, input.expectedVersion);
    try { await ensureMediaBucket(storage); } catch (error) { if (error instanceof ServiceError) throw error; throw storageServiceError(error); }
    const bucket = bucketFor(storage);
    if (!bucket.createSignedUploadUrl) throw new ServiceError(501, 'media_direct_unsupported');
    const mediaId = env.newId();
    const path = mediaPath(giftId, mediaId, declared.ext);
    let signed: Awaited<ReturnType<NonNullable<MediaBucket['createSignedUploadUrl']>>>;
    try { signed = await bucket.createSignedUploadUrl(path, { upsert: false }); }
    catch (error) { throw storageServiceError(error); }
    if (signed.error) throw storageServiceError(signed.error);
    if (!signed.data?.token) throw new ServiceError(502, 'media_storage_failed', 'storage returned no upload token');
    return { mediaId, path, bucket: MEDIA_BUCKET, uploadToken: signed.data.token, mime: declared.mime, ext: declared.ext };
  });
}

type ObjectHead = { bytes: Uint8Array; total: number | null };
async function readObjectHead(url: string): Promise<ObjectHead> {
  const response = await fetch(url, { headers: { range: 'bytes=0-63' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (response.status === 404 || response.status === 400) throw new ServiceError(409, 'media_object_missing', `storage answered ${response.status}`);
  if (!response.ok && response.status !== 206) throw new ServiceError(502, 'media_storage_failed', `storage answered ${response.status}`);
  const range = response.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length'));
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError(502, 'media_storage_failed', 'storage returned an empty body');
  const chunks: Uint8Array[] = []; let read = 0;
  while (read < 64) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value); read += part.value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(read, 64)); let offset = 0;
  for (const chunk of chunks) { for (const byte of chunk) { if (offset >= bytes.length) break; bytes[offset++] = byte; } }
  return { bytes, total: Number.isFinite(total) && total > 0 ? total : null };
}

export type ObjectReader = (url: string) => Promise<ObjectHead>;

/**
 * Finish a direct upload. Idempotent: calling it again for the same mediaId returns the existing
 * reference instead of creating a duplicate, so a retry after a failed response is always safe.
 */
export function completeDirectUpload(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { mediaId: unknown; kind: unknown; mime: unknown; fileName?: unknown; placement?: unknown; expectedVersion: unknown }, readHead: ObjectReader = readObjectHead) {
  return guarded(async () => {
    if (typeof input.mediaId !== 'string' || !MEDIA_ID.test(input.mediaId)) throw new ServiceError(400, 'invalid_media_id');
    if (!Number.isInteger(input.expectedVersion)) throw new ServiceError(400, 'invalid_expected_version');
    const id = input.mediaId;
    const bucket = bucketFor(storage);
    const requested = declareMedia(input.kind, input.mime, input.fileName, 1);
    const path = mediaPath(giftId, id, requested.ext);

    // Retry-safe: a previous attempt may already have committed this reference.
    const existing = await env.store.runTransaction(async (tx) => {
      const gift = await loadGuestForMedia(tx, env, giftId, token);
      const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
      if (!current.ok) throw new ServiceError(400, 'invalid_content');
      return { media: current.content.media.find((item) => item.id === id) ?? null, version: gift.draft.version as number };
    });
    if (existing.media) {
      if (existing.media.path !== path) throw new ServiceError(409, 'media_id_conflict');
      const signed = await bucket.createSignedUrl(path, 900);
      if (signed.error || !signed.data?.signedUrl) throw storageServiceError(signed.error ?? 'could not sign existing media');
      return { media: existing.media, version: existing.version, signedUrl: signed.data.signedUrl, alreadyCommitted: true };
    }

    await checkUpload(env, giftId, token, requested.kind, input.expectedVersion);

    let signed: { data: { signedUrl: string } | null; error: unknown };
    try { signed = await bucket.createSignedUrl(path, 900); } catch (error) { throw storageServiceError(error); }
    if (signed.error || !signed.data?.signedUrl) throw new ServiceError(409, 'media_object_missing', sanitizeErrorDetail(signed.error ?? 'object not found'));
    let head: ObjectHead;
    try { head = await readHead(signed.data.signedUrl); }
    catch (error) { if (error instanceof ServiceError) throw error; throw storageServiceError(error); }

    let verified: ReturnType<typeof validateMediaFile>;
    try { verified = validateMediaFile(requested.kind, requested.mime, head.bytes, input.fileName, head.total ?? undefined); }
    catch (error) {
      // The stored bytes are not what was declared (or exceed the limit): never keep or reference them.
      try { await bucket.remove([path]); } catch { /* the private object is unreferenced; cleanup is best effort */ }
      throw error;
    }
    const sizeBytes = head.total ?? head.bytes.byteLength;

    const committed = await env.store.runTransaction(async (tx) => {
      const gift = await loadGuestForMedia(tx, env, giftId, token);
      if (gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
      const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
      if (!current.ok) throw new ServiceError(400, 'invalid_content');
      if (input.placement !== undefined && (input.placement !== 'hero' || verified.kind !== 'image')) throw new ServiceError(400, 'invalid_media_placement');
      const media = { id, kind: verified.kind, path, ...(verified.name ? { name: verified.name } : {}), ...(input.placement === 'hero' ? { placement: 'hero' as const } : {}) };
      const content = { ...current.content, media: [...current.content.media, media] };
      const checked = validateGiftContent(content, { mediaEnabled: true });
      if (!checked.ok) throw new ServiceError(400, 'invalid_media_ref', checked.detail);
      const now = env.ts(env.nowMs());
      const version = gift.draft.version + 1;
      tx.update(`gifts/${giftId}`, { draft: { content: checked.content, version, updatedAt: now }, updatedAt: now });
      tx.create(`giftMedia/${id}`, { giftId, ownerUid: gift.ownerUid, kind: verified.kind, storagePath: path, contentType: verified.mime, sizeBytes, createdAt: now, deletedAt: null, schemaVersion: 1 });
      return { media, version };
    });
    return { ...committed, signedUrl: signed.data.signedUrl };
  });
}

/** Remove an uploaded-but-never-referenced object after the client gives up on a failed `complete`. */
export function abortDirectUpload(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { mediaId: unknown; mime: unknown; kind: unknown; fileName?: unknown }) {
  return guarded(async () => {
    if (typeof input.mediaId !== 'string' || !MEDIA_ID.test(input.mediaId)) throw new ServiceError(400, 'invalid_media_id');
    const id = input.mediaId;
    const declared = declareMedia(input.kind, input.mime, input.fileName, 1);
    const path = mediaPath(giftId, id, declared.ext);
    const referenced = await env.store.runTransaction(async (tx) => {
      const gift = await loadGuestForMedia(tx, env, giftId, token);
      const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
      if (!current.ok) throw new ServiceError(400, 'invalid_content');
      const row = await tx.get(`giftMedia/${id}`);
      return current.content.media.some((item) => item.id === id) || (row != null && !row.deletedAt);
    });
    if (referenced) return { removed: false };
    try { await bucketFor(storage).remove([path]); } catch (error) { throw storageServiceError(error); }
    return { removed: true };
  });
}
