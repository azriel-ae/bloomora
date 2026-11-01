import { NextResponse } from 'next/server';
import { getGuestGiftDraft, saveGuestGiftDraft } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';
import { lookupTemplate } from '@/lib/server/template-lookup';

function token(request: Request): string | null {
  const value = request.headers.get('x-bloomora-edit-token');
  return value && value.length >= 32 ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const result = await getGuestGiftDraft(env, (await params).giftId, token(request));
  return result.ok ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } }) : NextResponse.json(result, { status: result.status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400 });
  const result = await saveGuestGiftDraft(env, (await params).giftId, token(request), body as { expectedVersion: unknown; content: unknown }, lookupTemplate);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: result.status });
}
