import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { sessionCookieName, sessionCookieOptions } from '@/lib/session';

const bodySchema = z.object({ idToken: z.string().min(20) });
export async function POST(request: Request) {
  const admin = getFirebaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Firebase server configuration is missing.' }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A valid Firebase ID token is required.' }, { status: 400 });
  try {
    const decoded = await admin.auth.verifyIdToken(parsed.data.idToken);
    const sessionCookie = await admin.auth.createSessionCookie(parsed.data.idToken, { expiresIn: 1000 * 60 * 60 * 24 * 5 });
    await admin.db.collection('users').doc(decoded.uid).set({ uid: decoded.uid, email: decoded.email ?? null, displayName: decoded.name ?? null, updatedAt: new Date().toISOString() }, { merge: true });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, sessionCookie, sessionCookieOptions(60 * 60 * 24 * 5));
    return response;
  } catch {
    return NextResponse.json({ error: 'That sign-in session could not be verified.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, '', sessionCookieOptions(0));
  return response;
}
