import { NextResponse } from 'next/server';
import { listActivePaymentMethods } from '@/lib/server/services';
import { getServerEnv } from '@/lib/server/runtime';

export async function GET() {
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503, headers: { 'cache-control': 'private, no-store' } });
  const result = await listActivePaymentMethods(env);
  return result.ok
    ? NextResponse.json(result, { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' } })
    : NextResponse.json(result, { status: result.status, headers: { 'cache-control': 'no-store' } });
}
