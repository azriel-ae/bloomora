import { NextResponse } from 'next/server';
import { getCurrentUser } from '../session';
import { getServerEnv } from './runtime';
import { DEV_EDITOR_UID, getDevEditorEnv, isEditorDevMode } from './dev-editor-env';
import type { Actor } from './services';
import type { Env, Result } from './store';

export const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export function resultResponse(r: Result<Record<string, unknown>>) {
  if (r.ok) return json(200, { ...r });
  const currentVersion = r.code === 'version_conflict' && r.detail && /^\d+$/.test(r.detail) ? Number(r.detail) : undefined;
  return json(r.status, { ok: false, code: r.code, ...(currentVersion === undefined ? {} : { currentVersion }) });
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
  opts: { body?: boolean; editorDev?: boolean } = { body: true },
) {
  if (!sameOrigin(request)) return json(403, { ok: false, code: 'bad_origin' });
  const editorDev = opts.editorDev === true && isEditorDevMode();
  const env = editorDev ? getDevEditorEnv() : getServerEnv();
  if (!env) return json(503, { ok: false, code: 'server_not_configured' });
  const user = editorDev ? null : await getCurrentUser();
  if (!user && !editorDev) return json(401, { ok: false, code: 'sign_in_required' });
  let body: Record<string, unknown> = {};
  if (opts.body !== false) {
    const parsed = await request.json().catch(() => null);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json(400, { ok: false, code: 'invalid_body' });
    body = parsed as Record<string, unknown>;
  }
  // The admin flag comes only from the verified session token's custom claim.
  const actor: Actor = { uid: editorDev ? DEV_EDITOR_UID : user!.uid, admin: !editorDev && (user as { admin?: unknown }).admin === true };
  return resultResponse(await run(env, actor, body));
}
