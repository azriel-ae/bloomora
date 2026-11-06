import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { deleteGuestMedia, getGuestMediaUrls, MAX_MEDIA_BYTES, uploadGuestMedia } from '@/lib/server/media-services';
import { getServerEnv } from '@/lib/server/runtime';

const privateJson = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });
function token(request: Request): string | null { return request.headers.get('x-bloomora-edit-token'); }
export async function POST(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  const storage = createSupabaseAdminClient();
  if (!env || !storage) return privateJson({ ok: false, code: 'server_not_configured' }, 503);
  const requestBytes = Number(request.headers.get('content-length'));
  if (Number.isFinite(requestBytes) && requestBytes > MAX_MEDIA_BYTES + 64 * 1024) return privateJson({ ok: false, code: 'invalid_media_size' }, 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return privateJson({ ok: false, code: 'file_required' }, 400);
  const result = await uploadGuestMedia(env, storage, (await params).giftId, token(request), {
    kind: form?.get('kind'), expectedVersion: Number(form?.get('expectedVersion')),
    bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type,
  });
  return result.ok ? privateJson(result) : privateJson(result, result.status);
}
export async function GET(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  const storage = createSupabaseAdminClient();
  if (!env || !storage) return privateJson({ ok: false, code: 'server_not_configured' }, 503);
  const result = await getGuestMediaUrls(env, storage, (await params).giftId, token(request));
  return result.ok ? privateJson(result) : privateJson(result, result.status);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  const storage = createSupabaseAdminClient();
  if (!env || !storage) return privateJson({ ok: false, code: 'server_not_configured' }, 503);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return privateJson({ ok: false, code: 'invalid_body' }, 400);
  const data = body as Record<string, unknown>;
  const result = await deleteGuestMedia(env, storage, (await params).giftId, token(request), {
    mediaId: data.mediaId,
    expectedVersion: data.expectedVersion,
  });
  return result.ok ? privateJson(result) : privateJson(result, result.status);
}
