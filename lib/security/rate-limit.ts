import { createHash } from 'node:crypto';
import type { Doc, Tx } from '../server/store.ts';

export type RateLimitPolicy = { max: number; windowMs: number };

export type RateLimitResult =
  | { ok: true; count: number; resetAtMs: number }
  | { ok: false; retryAfterMs: number; resetAtMs: number };

/** Hash the logical identity before it becomes a PostgreSQL path. */
export function rateLimitPath(scope: string, identity: string): string {
  const digest = createHash('sha256').update(`${scope}:${identity}`, 'utf8').digest('hex');
  return `rateLimits/${digest}`;
}

/** Consume one operation after the request identity has been authenticated. */
export async function consumeRateLimit(
  tx: Tx, scope: string, identity: string, nowMs: number, policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  if (!Number.isInteger(policy.max) || policy.max < 1 || !Number.isInteger(policy.windowMs) || policy.windowMs < 1) {
    throw new Error('invalid rate-limit policy');
  }
  const resetAtMs = (Math.floor(nowMs / policy.windowMs) + 1) * policy.windowMs;
  const path = rateLimitPath(scope, identity);
  const existing = await tx.get(path);
  const existingResetAtMs = Number(existing?.resetAtMs ?? 0);
  const count = existingResetAtMs > nowMs ? Number(existing?.count ?? 0) : 0;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('invalid rate-limit record');
  if (count >= policy.max) return { ok: false, retryAfterMs: Math.max(0, resetAtMs - nowMs), resetAtMs };
  const next: Doc = { scope, count: count + 1, windowStartedAtMs: resetAtMs - policy.windowMs, resetAtMs, updatedAtMs: nowMs, schemaVersion: 1 };
  if (existing) tx.update(path, next); else tx.create(path, next);
  return { ok: true, count: count + 1, resetAtMs };
}
