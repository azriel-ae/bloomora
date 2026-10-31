import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getServerEnv } from '@/lib/server/runtime';
import { exportDashboardData } from '@/lib/server/services';

const csvCell = (value: unknown): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, code: 'sign_in_required' }, { status: 401 });
  const env = getServerEnv();
  if (!env) return NextResponse.json({ ok: false, code: 'server_not_configured' }, { status: 503 });
  const result = await exportDashboardData(env, { uid: user.uid, admin: (user as { admin?: unknown }).admin === true });
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
  if (format === 'json') return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), gifts: result.gifts }), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="bloomora-gifts.json"', 'cache-control': 'private, no-store' } });
  const headers = ['giftId', 'slug', 'status', 'templateId', 'templateVersion', 'draftVersion', 'publishedRevision', 'createdAtMs', 'updatedAtMs', 'totalViews', 'draftContent'];
  const rows = result.gifts.map((gift) => headers.map((header) => csvCell(gift[header as keyof typeof gift])).join(','));
  return new NextResponse([headers.join(','), ...rows].join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="bloomora-gifts.csv"', 'cache-control': 'private, no-store' } });
}
