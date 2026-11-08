import { NextResponse } from 'next/server';
import { validateGuestVoucher } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400 });
  }
  try {
    const input = body as { giftId: unknown; editToken: unknown; packageId: unknown; voucherCode: unknown };
    const result = await validateGuestVoucher(env, input);
    return result.ok
      ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
      : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('[guest-voucher-validate]', { name: error instanceof Error ? error.name : 'unknown', message: error instanceof Error ? error.message.slice(0, 240) : 'unknown_error' });
    return NextResponse.json({ ok: false, code: 'voucher_validation_failed' }, { status: 500, headers: { 'cache-control': 'private, no-store' } });
  }
}
