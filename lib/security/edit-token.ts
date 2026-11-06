import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const EDIT_TOKEN_BYTES = 32;

export function createEditToken(): string {
  return randomBytes(EDIT_TOKEN_BYTES).toString('base64url');
}

export function hashEditToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verifyEditToken(token: unknown, expectedHash: unknown): boolean {
  if (typeof token !== 'string' || token.length < 32 || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashEditToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function guestOwnerId(token: string): string {
  return `guest_${hashEditToken(token).slice(0, 40)}`;
}
