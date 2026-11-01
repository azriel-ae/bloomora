import { NextResponse } from 'next/server';
import { createGuestGift } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';
import { lookupTemplate } from '@/lib/server/template-lookup';

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400 });
  const result = await createGuestGift(env, body as { templateId: unknown; content: unknown; customSlug?: unknown; email?: unknown; whatsapp?: unknown }, lookupTemplate);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: result.status });
}
