import { createSupabaseBrowserClient } from '../supabase/client';
import type { GiftContent } from '../model/types';

export type DirectUploadResult =
  | { ok: true; media: GiftContent['media'][number]; version: number; signedUrl: string }
  | { ok: false; code: string; detail?: string };

type Json = { ok?: boolean; code?: string; detail?: string; mediaId?: string; path?: string; uploadToken?: string; mime?: string; bucket?: string; media?: GiftContent['media'][number]; version?: number; signedUrl?: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function post(url: string, headers: HeadersInit, body: Record<string, unknown>): Promise<{ status: number; data: Json }> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as Json;
  return { status: response.status, data };
}

/** Classify a Supabase Storage error returned to the browser while sending bytes. */
export function classifyBrowserStorageError(error: unknown): { code: string; detail: string } {
  const e = error as { statusCode?: string | number; status?: number; message?: string; error?: string } | null;
  const message = `${e?.error ?? ''} ${e?.message ?? ''}`.toLowerCase();
  const status = Number(e?.statusCode ?? e?.status);
  const detail = String(e?.message ?? 'storage upload failed').slice(0, 200);
  if (/mime type|not supported|invalid_mime/.test(message) || status === 415) return { code: 'media_storage_mime_rejected', detail };
  if (/exceeded the maximum allowed size|too large|payload/.test(message) || status === 413) return { code: 'media_storage_too_large', detail };
  if (/bucket not found/.test(message)) return { code: 'media_bucket_missing', detail };
  if (/already exists|duplicate/.test(message) || status === 409) return { code: 'media_object_exists', detail };
  if (status === 401 || status === 403 || /unauthorized|forbidden|permission|row-level security|expired|invalid token|jwt/.test(message)) return { code: 'media_storage_forbidden', detail };
  if (/failed to fetch|network|load failed/.test(message)) return { code: 'network_error', detail };
  return { code: 'media_storage_failed', detail };
}

/**
 * Upload one file straight to the private bucket with a server-issued one-shot token, then ask the server
 * to verify the stored object and write the reference. Never sends the file through the Vercel Function.
 * `nextVersion` must flush pending autosave and return the current draft version (or null if changes are pending).
 */
export async function uploadDirectToStorage(args: {
  giftId: string; headers: HeadersInit; kind: 'image' | 'audio'; file: File; placement?: 'hero';
  expectedVersion: number; nextVersion: () => Promise<number | null>;
}): Promise<DirectUploadResult> {
  const { giftId, headers, kind, file, placement } = args;
  const base = `/api/guest/gifts/${encodeURIComponent(giftId)}/media`;
  const client = createSupabaseBrowserClient();
  if (!client) return { ok: false, code: 'media_direct_unavailable' };

  let init: Awaited<ReturnType<typeof post>>;
  try { init = await post(`${base}/upload-url`, headers, { kind, mime: file.type, fileName: file.name, size: file.size, placement, expectedVersion: args.expectedVersion }); }
  catch { return { ok: false, code: 'network_error' }; }
  if (!init.data.ok || !init.data.uploadToken || !init.data.path || !init.data.mediaId) {
    return { ok: false, code: init.data.code ?? (init.status === 404 ? 'media_direct_unavailable' : 'media_server_failed'), detail: init.data.detail };
  }
  const { mediaId, path, uploadToken, mime } = init.data;

  try {
    const { error } = await client.storage.from(init.data.bucket ?? 'gift-media').uploadToSignedUrl(path, uploadToken, file, { contentType: mime ?? file.type });
    if (error) { const failure = classifyBrowserStorageError(error); return { ok: false, ...failure }; }
  } catch (error) {
    return { ok: false, ...classifyBrowserStorageError(error) };
  }

  const completeBody = { mediaId, kind, mime, fileName: file.name, placement };
  let version = args.expectedVersion;
  let last: { code: string; detail?: string } = { code: 'media_server_failed' };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const done = await post(`${base}/complete`, headers, { ...completeBody, expectedVersion: version });
      if (done.data.ok && done.data.media && Number.isInteger(done.data.version) && typeof done.data.signedUrl === 'string') {
        return { ok: true, media: done.data.media, version: done.data.version as number, signedUrl: done.data.signedUrl };
      }
      last = { code: done.data.code ?? 'media_server_failed', detail: done.data.detail };
      if (done.data.code === 'version_conflict') {
        const fresh = await args.nextVersion();
        if (fresh === null) { last = { code: 'media_pending_changes' }; break; }
        version = fresh; continue;
      }
      if (!['media_server_failed', 'media_database_failed', 'media_storage_failed', 'media_storage_timeout'].includes(last.code)) break;
    } catch { last = { code: 'network_error' }; }
    await wait(400 * (attempt + 1));
  }
  // The object is stored but could not be referenced: release it so a re-upload never leaves a stray file.
  try { await post(`${base}/complete`, headers, { ...completeBody, abort: true }); } catch { /* best effort */ }
  return { ok: false, ...last };
}
