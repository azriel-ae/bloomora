import { NextResponse } from 'next/server';
import { publishGuestGift } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';
import { getDevEditorEnv, isEditorDevMode } from '@/lib/server/dev-editor-env';
import { lookupTemplate } from '@/lib/server/template-lookup';

export async function POST(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = isEditorDevMode() ? getDevEditorEnv() : getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400 });
  const editToken = request.headers.get('x-bloomora-edit-token');
  const { giftId } = await params;
  const result = await publishGuestGift(env, giftId, editToken, { expectedVersion: body.expectedVersion }, lookupTemplate);
  return result.ok
    ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
    : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
}
