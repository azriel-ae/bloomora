import { NextResponse } from 'next/server';
import { deleteGuestOrder, getGuestOrderDetail } from '@/lib/server/guest-services';
import { getServerEnv } from '@/lib/server/runtime';

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503, headers: { 'cache-control': 'private, no-store' } });
  const { orderId } = await params;
  const accessToken = request.headers.get('x-bloomora-order-token');
  const result = await getGuestOrderDetail(env, orderId, accessToken);
  return result.ok
    ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
    : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503, headers: { 'cache-control': 'private, no-store' } });
  const { orderId } = await params;
  const result = await deleteGuestOrder(env, orderId, request.headers.get('x-bloomora-order-token'));
  return result.ok
    ? NextResponse.json(result, { headers: { 'cache-control': 'private, no-store' } })
    : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'private, no-store' } });
}
