import { validateGiftContent } from '../model/content.ts';
import { loadGuestForMedia } from './guest-services.ts';
import { ServiceError, guarded, type Env } from './store.ts';
import { consumeRateLimit, type RateLimitPolicy } from '../security/rate-limit.ts';

export const MEDIA_BUCKET = 'gift-media';
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
/** Guest drafts may exceed a paid package temporarily; checkout remains the entitlement gate. */
export const MAX_GUEST_PHOTOS = 100;
export const MAX_GUEST_AUDIO = 1;
const MEDIA_WRITE_POLICY: RateLimitPolicy = { max: 30, windowMs: 60_000 };
const MEDIA_READ_POLICY: RateLimitPolicy = { max: 120, windowMs: 60_000 };
export type BucketOptions = { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] };
export type MediaStorage = { storage: { from(bucket: string): unknown; getBucket?(id: string): Promise<{ data: { public?: boolean; file_size_limit?: number | null; allowed_mime_types?: string[] | null } | null; error: unknown }>; createBucket?(id: string, options: BucketOptions): Promise<{ error: unknown }>; updateBucket?(id: string, options: BucketOptions): Promise<{ error: unknown }> } };
export type MediaBucket = {
  createSignedUploadUrl?(path: string, options?: { upsert: boolean }): Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: unknown }>;
  upload(path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }): Promise<{ error: unknown }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  remove(paths: string[]): Promise<unknown>;
};
export const bucketFor = (storage: MediaStorage): MediaBucket => storage.storage.from(MEDIA_BUCKET) as MediaBucket;
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a']);
export type MediaKind = 'image' | 'audio';
export const MIME_BY_EXTENSION: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', mp4: 'audio/mp4', m4a: 'audio/x-m4a', ogg: 'audio/ogg', wav: 'audio/wav' };
export function mimeFromName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return MIME_BY_EXTENSION[ext] ?? null;
}
export function validateMediaFile(kind: unknown, mime: unknown, bytes: Uint8Array, fileName?: unknown, totalBytes?: number): { kind: MediaKind; mime: string; ext: string; name?: string } {
  if (kind !== 'image' && kind !== 'audio') throw new ServiceError(400, 'invalid_media_kind');
  const size = totalBytes ?? bytes.byteLength;
  if (!Number.isInteger(size) || size < 1 || size > MAX_MEDIA_BYTES || bytes.byteLength < 1) throw new ServiceError(413, 'invalid_media_size');
  const suppliedMime = typeof mime === 'string' ? mime.toLowerCase().trim() : '';
  const inferredMime = mimeFromName(fileName);
  const normalizedMime = suppliedMime && suppliedMime !== 'application/octet-stream' ? suppliedMime : inferredMime;
  if (!normalizedMime || !(kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES).has(normalizedMime)) throw new ServiceError(415, 'invalid_media_type');
  const b = bytes;
  const starts = (...a: number[]) => a.every((v, i) => b[i] === v);
  let actual: string | null = null;
  if (starts(0xff, 0xd8, 0xff)) actual = 'image/jpeg';
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) actual = 'image/png';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') actual = 'image/webp';
  else if (starts(0x49, 0x44, 0x33) || (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) actual = 'audio/mpeg';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(4, 8)) === 'ftyp') actual = normalizedMime === 'audio/x-m4a' ? 'audio/x-m4a' : 'audio/mp4';
  else if (b.length >= 4 && String.fromCharCode(...b.slice(0, 4)) === 'OggS') actual = 'audio/ogg';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WAVE') actual = 'audio/wav';
  if (!actual || (actual !== normalizedMime && !(actual === 'audio/mp4' && normalizedMime === 'audio/x-m4a'))) throw new ServiceError(415, 'media_signature_mismatch');
  const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a' };
  const safeName = typeof fileName === 'string' ? fileName.trim().replace(/[\u0000-\u001f\\/]+/g, '_').slice(0, 180) : '';
  return { kind, mime: normalizedMime, ext: ext[normalizedMime], ...(safeName ? { name: safeName } : {}) };
}

export type StorageFailure = { code: string; detail: string };
/** Strip anything secret-looking before an error message is logged or returned to the editor. */
export function sanitizeErrorDetail(value: unknown): string {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : (value as { message?: unknown } | null)?.message;
  return String(raw ?? 'unknown error')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted-jwt]')
    .replace(/[?&]token=[^\s&"']+/gi, '?token=[redacted]')
    .replace(/[A-Za-z0-9_-]{43,}/g, '[redacted-token]')
    .slice(0, 240);
}

/** Map a Supabase Storage / network error to a specific, user-actionable code (never a generic one when the cause is known). */
export function classifyStorageError(error: unknown): StorageFailure {
  const e = error as { statusCode?: string | number; status?: number; error?: string; message?: string; name?: string } | null;
  const status = Number(e?.statusCode ?? e?.status);
  const message = `${e?.name ?? ''} ${e?.error ?? ''} ${e?.message ?? ''}`.toLowerCase();
  const detail = sanitizeErrorDetail(error);
  if (/bucket not found|no such bucket/.test(message) || (status === 404 && /bucket/.test(message))) return { code: 'media_bucket_missing', detail };
  if (/mime type|mimetype|not supported|unsupported media|invalid_mime_type/.test(message) || status === 415) return { code: 'media_storage_mime_rejected', detail };
  if (/exceeded the maximum allowed size|payload too large|too large|entity too large/.test(message) || status === 413) return { code: 'media_storage_too_large', detail };
  if (/timeout|timed out|aborted|aborterror/.test(message)) return { code: 'media_storage_timeout', detail };
  if (status === 401 || status === 403 || /permission|not authorized|unauthorized|row-level security|forbidden|invalid jwt|invalid api key/.test(message)) return { code: 'media_storage_forbidden', detail };
  return { code: 'media_storage_failed', detail };
}
export function storageServiceError(error: unknown): ServiceError {
  const { code, detail } = classifyStorageError(error);
  return new ServiceError(502, code, detail);
}
/** Classify a database/other server error thrown outside Storage so the cause is not hidden. */
export function classifyServerError(error: unknown): StorageFailure {
  const e = error as { code?: string; message?: string } | null;
  const detail = sanitizeErrorDetail(error);
  if (e?.code === '42P01' || e?.code === '42703') return { code: 'media_database_schema_missing', detail };
  if (e?.code === '23503' || e?.code === '23505' || e?.code === '23514' || e?.code === '22P02') return { code: 'media_database_failed', detail };
  if (typeof e?.code === 'string' && /^(08|53|57|40)/.test(e.code)) return { code: 'media_database_failed', detail };
  if (/transaction_read_after_write|document_not_found|unsupported_/.test(detail)) return { code: 'media_database_failed', detail };
  if (/timeout|timed out|connect|ECONN|ETIMEDOUT/i.test(detail)) return { code: 'media_database_failed', detail };
  return { code: 'media_server_failed', detail };
}
async function bestEffortRemove(bucket: MediaBucket, paths: string[]) {
  try { await bucket.remove(paths); } catch (error) { console.error('[guest-media-upload] cleanup failed', sanitizeErrorDetail(error)); }
}

export async function checkUpload(env: Env, giftId: string, token: unknown, kind: MediaKind, expectedVersion: unknown) {
  return env.store.runTransaction(async tx => {
    const gift = await loadGuestForMedia(tx, env, giftId, token);
    const rate = await consumeRateLimit(tx, 'guest-media-upload', gift.ownerUid, env.nowMs(), MEDIA_WRITE_POLICY);
    if (!rate.ok) throw new ServiceError(429, 'rate_limited', String(Math.ceil(rate.retryAfterMs / 1000)));
    if (gift.status === 'archived') throw new ServiceError(403, 'gift_archived');
    if (!Number.isInteger(expectedVersion) || gift.draft.version !== expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
    const valid = validateGiftContent(gift.draft.content, { mediaEnabled: true });
    if (!valid.ok) throw new ServiceError(400, 'invalid_content');
    const existingCount = valid.content.media.filter((media) => media.kind === kind).length;
    if (kind === 'image' && existingCount >= MAX_GUEST_PHOTOS) throw new ServiceError(400, 'guest_media_limit');
    if (kind === 'audio' && existingCount >= MAX_GUEST_AUDIO) throw new ServiceError(400, 'guest_audio_limit');
    return { gift, content: valid.content };
  });
}

export async function uploadGuestMedia(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { kind: unknown; placement?: unknown; expectedVersion: unknown; bytes: Uint8Array; mime: unknown; fileName?: unknown }) {
  const result = await guarded(async () => {
    const { kind, mime, ext, name } = validateMediaFile(input.kind, input.mime, input.bytes, input.fileName);
    if (input.placement !== undefined && (input.placement !== 'hero' || kind !== 'image')) throw new ServiceError(400, 'invalid_media_placement');
    if (!Number.isInteger(input.expectedVersion)) throw new ServiceError(400, 'invalid_expected_version');
    await checkUpload(env, giftId, token, kind, input.expectedVersion);
    const id = env.newId();
    const path = `private/${giftId}/${id}.${ext}`;
    const bucket = bucketFor(storage);
    let uploaded: { error: unknown };
    try { uploaded = await bucket.upload(path, input.bytes, { contentType: mime, upsert: false }); }
    catch (error) { throw storageServiceError(error); }
    if (uploaded.error) throw storageServiceError(uploaded.error);
    try {
      let signed: { data: { signedUrl: string } | null; error: unknown };
      try { signed = await bucket.createSignedUrl(path, 900); }
      catch (error) { throw storageServiceError(error); }
      if (signed.error) throw storageServiceError(signed.error);
      if (!signed.data?.signedUrl) throw new ServiceError(502, 'media_server_failed');
      const committed = await env.store.runTransaction(async tx => {
        const gift = await loadGuestForMedia(tx, env, giftId, token);
        if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
        const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
        if (!current.ok) throw new ServiceError(400, 'invalid_content');
        const media = { id, kind, path, ...(name ? { name } : {}), ...(input.placement === 'hero' ? { placement: 'hero' as const } : {}) };
        const content = { ...current.content, media: [...current.content.media, media] };
        const checked = validateGiftContent(content, { mediaEnabled: true });
        if (!checked.ok) throw new ServiceError(400, 'invalid_media_ref', checked.detail);
        const now = env.ts(env.nowMs());
        const version = gift.draft.version + 1;
        tx.update(`gifts/${giftId}`, { draft: { content: checked.content, version, updatedAt: now }, updatedAt: now });
        tx.create(`giftMedia/${id}`, { giftId, ownerUid: gift.ownerUid, kind, storagePath: path, contentType: mime, sizeBytes: input.bytes.byteLength, createdAt: now, deletedAt: null, schemaVersion: 1 });
        return { media, version };
      });
      return { ...committed, signedUrl: signed.data.signedUrl };
    } catch (e) {
      await bestEffortRemove(bucket, [path]);
      throw e;
    }
  });
  return result;
}

export function getGuestMediaUrls(env: Env, storage: MediaStorage, giftId: string, token: unknown) {
  return guarded(async () => {
    const media = await env.store.runTransaction(async tx => {
      const gift = await loadGuestForMedia(tx, env, giftId, token);
      const rate = await consumeRateLimit(tx, 'guest-media-read', gift.ownerUid, env.nowMs(), MEDIA_READ_POLICY);
      if (!rate.ok) throw new ServiceError(429, 'rate_limited', String(Math.ceil(rate.retryAfterMs / 1000)));
      const content = validateGiftContent(gift.draft.content, { mediaEnabled: true });
      if (!content.ok) throw new ServiceError(400, 'invalid_content');
      return content.content.media;
    });
    const mediaUrls: Record<string, string> = {};
    const bucket = bucketFor(storage);
    for (const ref of media) {
      if (!/^private\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|mp3|mp4|ogg|wav|m4a)$/.test(ref.path) || !ref.path.startsWith(`private/${giftId}/`)) throw new ServiceError(400, 'invalid_media_ref');
      // One missing/unsignable object must not take down every other photo or the audio of this draft.
      let signed: { data: { signedUrl: string } | null; error: unknown };
      try { signed = await bucket.createSignedUrl(ref.path, 900); }
      catch (error) { console.error('[guest-media] sign failed', ref.id, sanitizeErrorDetail(error)); continue; }
      if (signed.error || !signed.data?.signedUrl) { console.error('[guest-media] sign failed', ref.id, sanitizeErrorDetail(signed.error)); continue; }
      mediaUrls[ref.id] = signed.data.signedUrl;
    }
    return { mediaUrls };
  });
}

/** Remove one media reference from the private draft without touching a published revision. */
export function deleteGuestMedia(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { mediaId: unknown; expectedVersion: unknown }) {
  return guarded(async () => {
    const deleted = await env.store.runTransaction(async tx => {
      const gift = await loadGuestForMedia(tx, env, giftId, token);
      if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) {
        throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
      }
      const mediaId = typeof input.mediaId === 'string' ? input.mediaId : '';
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(mediaId)) throw new ServiceError(400, 'invalid_media_id');
      const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
      if (!current.ok) throw new ServiceError(400, 'invalid_content', current.detail);
      const media = current.content.media.find((item) => item.id === mediaId);
      if (!media) throw new ServiceError(404, 'media_not_found');
      const nextContent = { ...current.content, media: current.content.media.filter((item) => item.id !== mediaId) };
      const checked = validateGiftContent(nextContent, { mediaEnabled: true });
      if (!checked.ok) throw new ServiceError(400, 'invalid_content', checked.detail);
      // Read all metadata and references before the first write. The production
      // PostgreSQL adapter deliberately rejects read-after-write transactions.
      const metadata = await tx.get(`giftMedia/${mediaId}`);
      const refs = await tx.query('giftMedia', 'storagePath', media.path);
      const stillReferenced = refs.some((row) => row.id !== mediaId && !row.data.deletedAt);
      const rate = await consumeRateLimit(tx, 'guest-media-delete', gift.ownerUid, env.nowMs(), MEDIA_WRITE_POLICY);
      if (!rate.ok) throw new ServiceError(429, 'rate_limited', String(Math.ceil(rate.retryAfterMs / 1000)));
      const now = env.ts(env.nowMs());
      const version = gift.draft.version + 1;
      tx.update(`gifts/${giftId}`, { draft: { content: checked.content, version, updatedAt: now }, updatedAt: now });
      if (metadata && metadata.giftId === giftId && !metadata.deletedAt) tx.update(`giftMedia/${mediaId}`, { deletedAt: now });
      // A published revision keeps its own copy of the media reference. Keep the object while the gift
      // is published so replacing music in the draft cannot silence the public page.
      return { mediaId, path: media.path, version, removeObject: !stillReferenced && gift.publishedRevision == null };
    });
    if (deleted.removeObject) {
      const removed = await bucketFor(storage).remove([deleted.path]);
      const error = (removed as { error?: unknown } | null)?.error;
      if (error) throw new ServiceError(502, 'media_storage_delete_failed');
    }
    return { mediaId: deleted.mediaId, version: deleted.version };
  });
}
