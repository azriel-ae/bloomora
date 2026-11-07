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
type MediaStorage = { storage: { from(bucket: string): unknown } };
type MediaBucket = {
  upload(path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }): Promise<{ error: unknown }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  remove(paths: string[]): Promise<unknown>;
};
const bucketFor = (storage: MediaStorage): MediaBucket => storage.storage.from(MEDIA_BUCKET) as MediaBucket;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a']);
export type MediaKind = 'image' | 'audio';
export function validateMediaFile(kind: unknown, mime: unknown, bytes: Uint8Array): { kind: MediaKind; mime: string; ext: string } {
  if (kind !== 'image' && kind !== 'audio') throw new ServiceError(400, 'invalid_media_kind');
  if (!Number.isInteger(bytes.byteLength) || bytes.byteLength < 1 || bytes.byteLength > MAX_MEDIA_BYTES) throw new ServiceError(413, 'invalid_media_size');
  if (typeof mime !== 'string' || !(kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES).has(mime)) throw new ServiceError(415, 'invalid_media_type');
  const b = bytes;
  const starts = (...a: number[]) => a.every((v, i) => b[i] === v);
  let actual: string | null = null;
  if (starts(0xff, 0xd8, 0xff)) actual = 'image/jpeg';
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) actual = 'image/png';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') actual = 'image/webp';
  else if (starts(0x49, 0x44, 0x33) || (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) actual = 'audio/mpeg';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(4, 8)) === 'ftyp') actual = mime === 'audio/x-m4a' ? 'audio/x-m4a' : 'audio/mp4';
  else if (b.length >= 4 && String.fromCharCode(...b.slice(0, 4)) === 'OggS') actual = 'audio/ogg';
  else if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WAVE') actual = 'audio/wav';
  if (!actual || (actual !== mime && !(actual === 'audio/mp4' && mime === 'audio/x-m4a'))) throw new ServiceError(415, 'media_signature_mismatch');
  const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a' };
  return { kind, mime, ext: ext[mime] };
}

async function checkUpload(env: Env, giftId: string, token: unknown, kind: MediaKind, expectedVersion: unknown) {
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

export async function uploadGuestMedia(env: Env, storage: MediaStorage, giftId: string, token: unknown, input: { kind: unknown; expectedVersion: unknown; bytes: Uint8Array; mime: unknown }) {
  const result = await guarded(async () => {
    const { kind, mime, ext } = validateMediaFile(input.kind, input.mime, input.bytes);
    if (!Number.isInteger(input.expectedVersion)) throw new ServiceError(400, 'invalid_expected_version');
    await checkUpload(env, giftId, token, kind, input.expectedVersion);
    const id = env.newId();
    const path = `private/${giftId}/${id}.${ext}`;
    const bucket = bucketFor(storage);
    const uploaded = await bucket.upload(path, input.bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw new ServiceError(502, 'media_storage_failed');
    try {
      const signed = await bucket.createSignedUrl(path, 900);
      if (signed.error || !signed.data?.signedUrl) throw new Error('media_sign_failed');
      const committed = await env.store.runTransaction(async tx => {
        const gift = await loadGuestForMedia(tx, env, giftId, token);
        if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
        const current = validateGiftContent(gift.draft.content, { mediaEnabled: true });
        if (!current.ok) throw new ServiceError(400, 'invalid_content');
        const media = { id, kind, path } as const;
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
      await bucket.remove([path]);
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
      const signed = await bucket.createSignedUrl(ref.path, 900);
      if (signed.error || !signed.data?.signedUrl) throw new ServiceError(502, 'media_sign_failed');
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
      return { mediaId, path: media.path, version, removeObject: !stillReferenced };
    });
    if (deleted.removeObject) {
      const removed = await bucketFor(storage).remove([deleted.path]);
      const error = (removed as { error?: unknown } | null)?.error;
      if (error) throw new ServiceError(502, 'media_storage_delete_failed');
    }
    return { mediaId: deleted.mediaId, version: deleted.version };
  });
}
