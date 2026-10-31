import { NextResponse } from 'next/server';
import { getCurrentUser } from '../session';
import { getServerEnv } from './runtime';
import type { Actor } from './services';
import type { Env, Result } from './store';

export const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export function resultResponse(r: Result<Record<string, unknown>>) {
  if (r.ok) return json(200, { ...r });
  return json(r.status, { ok: false, code: r.code });
}

/** Rejects cross-site browser requests. Session cookies are SameSite=Lax; this is a second layer. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients; still need a valid session cookie
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host')); } catch { return false; }
}

export async function withActor(
  request: Request,
  run: (env: Env, actor: Actor, body: Record<string, unknown>) => Promise<Result<Record<string, unknown>>>,
  opts: { body?: boolean } = { body: true },
) {
  if (!sameOrigin(request)) return json(403, { ok: false, code: 'bad_origin' });
  const env = getServerEnv();
  if (!env) return json(503, { ok: false, code: 'server_not_configured' });
  const user = await getCurrentUser();
  if (!user) return json(401, { ok: false, code: 'sign_in_required' });
  let body: Record<string, unknown> = {};
  if (opts.body !== false) {
    const parsed = await request.json().catch(() => null);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json(400, { ok: false, code: 'invalid_body' });
    body = parsed as Record<string, unknown>;
  }
  // The admin flag comes only from the verified session token's custom claim.
  const actor: Actor = { uid: user.uid, admin: (user as { admin?: unknown }).admin === true };
  return resultResponse(await run(env, actor, body));
}
