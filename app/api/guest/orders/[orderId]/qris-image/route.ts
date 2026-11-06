import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getServerEnv } from '@/lib/server/runtime';
import { getGuestOrderQrisImagePath } from '@/lib/server/guest-services';

const BUCKET = 'payment-method-images';

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host')); }
  catch { return false; }
}

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, code: 'bad_origin' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  const token = request.headers.get('x-bloomora-order-token');
  if (!token) return NextResponse.json({ ok: false, code: 'order_not_found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const { orderId } = await context.params;
  const result = await getGuestOrderQrisImagePath(env, orderId, token);
  if (!result.ok) return NextResponse.json({ ok: false, code: result.code }, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: 'storage_not_configured' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const { data, error } = await admin.storage.from(BUCKET).download(result.imagePath);
  if (error || !data) return NextResponse.json({ ok: false, code: 'qris_image_unavailable' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const bytes = Buffer.from(await data.arrayBuffer());
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="bloomora-qris.png"',
    },
  });
}
