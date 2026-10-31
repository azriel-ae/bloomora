import { cookies } from 'next/headers';
import { getFirebaseAdmin } from './firebase-admin';

export const sessionCookieName = 'bloomora_session';

export async function getCurrentUser() {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  const cookieStore = await cookies();
  const session = cookieStore.get(sessionCookieName)?.value;
  if (!session) return null;
  try {
    return await admin.auth.verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge };
}
