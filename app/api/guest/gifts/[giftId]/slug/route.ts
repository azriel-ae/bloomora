import { NextResponse } from 'next/server';
import { checkGuestSlugAvailability } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';

export async function GET(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const token = request.headers.get('x-bloomora-edit-token');
  const slug = new URL(request.url).searchParams.get('slug');
  const result = await checkGuestSlugAvailability(env, (await params).giftId, token, slug);
  return result.ok
    ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
    : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
}
