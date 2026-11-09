import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { unlockPublicFlowerGift } from '@/lib/server/services';
import { getServerEnv } from '@/lib/server/runtime';
import { bucketFor, type MediaStorage } from '@/lib/server/media-services';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Ctx = { params: Promise<{ giftSlug: string }> };
const MAX_BODY_BYTES = 1024;
const MEDIA_PATH = /^private\/([A-Za-z0-9_-]{1,120})\/([A-Za-z0-9_-]{1,120})\.(?:jpg|png|webp|mp3|mp4|ogg|wav|m4a)$/;

function json(status: number, body: Record<string, unknown>, retryAfter?: number) {
  const response = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(retryAfter === undefined ? {} : { 'Retry-After': String(retryAfter) }) },
  });
  return response;
}

/** Accept only bounded, syntactically valid address headers; never hash an unbounded raw header. */
function requestIp(request: Request): string {
  for (const name of ['x-real-ip', 'cf-connecting-ip']) {
    const value = request.headers.get(name);
    if (value && value.length <= 64 && isIP(value.trim())) return value.trim();
  }
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.length <= 512) {
    const parts = forwarded.split(',');
    if (parts.length <= 8) {
      const first = parts[0]?.trim();
      if (first && first.length <= 64 && isIP(first)) return first;
    }
  }
  return 'unknown';
}

function callerIdentity(request: Request): string {
  return createHash('sha256').update(`public-flower-unlock:${requestIp(request)}`, 'utf8').digest('hex');
}

async function giftIdForPublishedSlug(env: NonNullable<ReturnType<typeof getServerEnv>>, slug: string): Promise<string | null> {
  return env.store.runTransaction(async (tx) => {
    const reservation = await tx.get(`slugs/${slug}`);
    if (typeof reservation?.giftId !== 'string') return null;
    const gift = await tx.get(`gifts/${reservation.giftId}`);
    return gift && gift.slug === slug && gift.status === 'published' ? reservation.giftId : null;
  });
}

async function signUnlockedMedia(
  env: NonNullable<ReturnType<typeof getServerEnv>>,
  slug: string,
  media: { id: string; path: string }[],
  storage: MediaStorage,
): Promise<Record<string, string>> {
  if (media.length > 101) throw new Error('too_many_media_references');
  const giftId = await giftIdForPublishedSlug(env, slug);
  if (!giftId) throw new Error('published_gift_unavailable');
  const bucket = bucketFor(storage);
  const mediaUrls: Record<string, string> = {};
  for (const ref of media) {
    const match = MEDIA_PATH.exec(ref.path);
    if (!match || match[1] !== giftId || match[2] !== ref.id) throw new Error('invalid_media_reference');
    try {
      const signed = await bucket.createSignedUrl(ref.path, 900);
      if (!signed.error && signed.data?.signedUrl) mediaUrls[ref.id] = signed.data.signedUrl;
    } catch {
      // A missing/unavailable object does not expose an error detail or block other media.
    }
  }
  return mediaUrls;
}

export async function POST(request: Request, { params }: Ctx) {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') return json(415, { ok: false, code: 'invalid_content_type' });
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    return json(413, { ok: false, code: 'invalid_body' });
  }
  const rawBody = await request.text().catch(() => '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return json(413, { ok: false, code: 'invalid_body' });
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return json(400, { ok: false, code: 'invalid_body' }); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)
    || Object.keys(body).length !== 1 || !('pin' in body)
    || typeof (body as { pin?: unknown }).pin !== 'string'
    || !/^[0-9]{4,6}$/.test((body as { pin: string }).pin)) {
    return json(400, { ok: false, code: 'invalid_body' });
  }

  const env = getServerEnv();
  if (!env) return json(503, { ok: false, code: 'server_not_configured' });
  const { giftSlug } = await params;
  const result = await unlockPublicFlowerGift(env, giftSlug, (body as { pin: string }).pin, callerIdentity(request));
  if (!result.ok) {
    if (result.code === 'wrong_pin') return json(401, { ok: false, code: 'wrong_pin', message: 'Incorrect PIN' });
    const retryAfter = result.code === 'rate_limited' && result.detail && /^\d+$/.test(result.detail) ? Number(result.detail) : undefined;
    return json(result.status, { ok: false, code: result.code }, retryAfter);
  }

  let mediaUrls: Record<string, string> = {};
  if (result.content.media.length > 0) {
    const admin = createSupabaseAdminClient();
    if (!admin) return json(503, { ok: false, code: 'server_not_configured' });
    try {
      mediaUrls = await signUnlockedMedia(env, giftSlug, result.content.media, admin as unknown as MediaStorage);
    } catch {
      return json(409, { ok: false, code: 'gift_unavailable' });
    }
  }
  return json(200, {
    ok: true,
    content: result.content,
    templateId: result.templateId,
    templateVersion: result.templateVersion,
    mediaUrls,
  });
}
