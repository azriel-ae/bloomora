import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const RECOVERY_TOKEN_BYTES = 32;

export function createRecoveryToken(): string {
  return randomBytes(RECOVERY_TOKEN_BYTES).toString('base64url');
}

export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(`bloomora:recovery:${token}`, 'utf8').digest('hex');
}

export function verifyRecoveryToken(token: unknown, expectedHash: unknown): boolean {
  if (typeof token !== 'string' || token.length < 32 || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashRecoveryToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Normalizes only for comparison/rate-limit hashing; the destination is never persisted. */
export function normalizeRecoveryDestination(channel: 'email' | 'whatsapp', value: string): string {
  return channel === 'email' ? value.trim().toLowerCase() : value.replace(/[\s().-]/g, '').trim();
}

export function hashRecoveryDestination(channel: 'email' | 'whatsapp', value: string): string {
  return createHash('sha256').update(`${channel}:${normalizeRecoveryDestination(channel, value)}`, 'utf8').digest('hex');
}
