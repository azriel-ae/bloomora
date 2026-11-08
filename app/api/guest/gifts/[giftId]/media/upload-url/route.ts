import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { initDirectUpload } from '@/lib/server/media-direct';
import { classifyServerError } from '@/lib/server/media-services';
import { getServerEnv } from '@/lib/server/runtime';

const privateJson = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

/** Authorizes the guest edit link and returns a one-shot signed upload token for an isolated path. */
export async function POST(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  const storage = createSupabaseAdminClient();
  if (!env || !storage) return privateJson({ ok: false, code: 'server_not_configured' }, 503);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return privateJson({ ok: false, code: 'invalid_body' }, 400);
  const data = body as Record<string, unknown>;
  const giftId = (await params).giftId;
  try {
    const result = await initDirectUpload(env, storage, giftId, request.headers.get('x-bloomora-edit-token'), {
      kind: data.kind, mime: data.mime, fileName: data.fileName, size: data.size, placement: data.placement, expectedVersion: data.expectedVersion,
    });
    return result.ok ? privateJson(result) : privateJson(result, result.status);
  } catch (error) {
    const failure = classifyServerError(error);
    console.error('[guest-media-upload] init failed', { giftId, ...failure });
    return privateJson({ ok: false, ...failure }, 502);
  }
}
