import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseServiceRoleKey } from '../env.ts';

const TOKEN_TTL_SECONDS = 5 * 60;
function signature(templateId: string, expiresAt: number, secret: string) {
  return createHmac('sha256', secret).update(`${templateId}\n${expiresAt}`).digest('base64url');
}
export function createDynamicTemplatePreviewToken(templateId: string, now = Math.floor(Date.now() / 1000)) {
  const secret = supabaseServiceRoleKey();
  if (!secret) throw new Error('server_not_configured');
  const expiresAt = now + TOKEN_TTL_SECONDS;
  return `${expiresAt}.${signature(templateId, expiresAt, secret)}`;
}
export function verifyDynamicTemplatePreviewToken(templateId: string, token: string, now = Math.floor(Date.now() / 1000)) {
  const secret = supabaseServiceRoleKey();
  if (!secret) return false;
  const [expiresText, supplied, extra] = token.split('.');
  const expiresAt = Number(expiresText);
  if (extra !== undefined || !Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + TOKEN_TTL_SECONDS + 30 || !supplied) return false;
  const expected = Buffer.from(signature(templateId, expiresAt, secret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
