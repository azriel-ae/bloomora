import { NextResponse } from 'next/server';
import { createGuestOrder } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400 });
  const input = body as { giftId?: unknown; editToken?: unknown; idempotencyKey?: unknown; packageId?: unknown; email?: unknown; whatsapp?: unknown; paymentMethodId?: unknown; voucherCode?: unknown; customSlug?: unknown };
  try {
    const result = await createGuestOrder(env, {
      giftId: input.giftId,
      editToken: input.editToken,
      idempotencyKey: input.idempotencyKey,
      packageId: input.packageId,
      email: input.email,
      whatsapp: input.whatsapp,
      paymentMethodId: input.paymentMethodId,
      voucherCode: input.voucherCode,
      customSlug: input.customSlug,
    });
    return result.ok
      ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
      : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('[guest-order-create]', { name: error instanceof Error ? error.name : 'unknown', message: error instanceof Error ? error.message.slice(0, 240) : 'unknown_error' });
    return NextResponse.json({ ok: false, code: 'order_create_failed' }, { status: 500, headers: { 'cache-control': 'private, no-store' } });
  }
}
