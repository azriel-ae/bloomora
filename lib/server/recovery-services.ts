import { createEditToken, hashEditToken } from '../security/edit-token.ts';
import { consumeRateLimit, type RateLimitPolicy } from '../security/rate-limit.ts';
import { createRecoveryToken, hashRecoveryDestination, hashRecoveryToken, normalizeRecoveryDestination } from '../security/recovery.ts';
import { ServiceError, guarded, type Doc, type Env } from './store.ts';

const RECOVERY_TTL_MS = 30 * 60_000;
const GUEST_EDIT_DAYS = 30;
const RECOVERY_POLICY: RateLimitPolicy = { max: 3, windowMs: 60 * 60_000 };

type RecoveryChannel = 'email' | 'whatsapp';
export interface RecoveryDeliveryProvider {
  send(input: { channel: RecoveryChannel; destination: string; recoveryUrl: string }): Promise<void>;
}

function validGiftId(giftId: string): boolean { return /^[A-Za-z0-9_-]{1,120}$/.test(giftId); }
function channel(value: unknown): RecoveryChannel | null { return value === 'email' || value === 'whatsapp' ? value : null; }
function destination(gift: Doc, selected: RecoveryChannel, raw: unknown): string {
  if (typeof raw !== 'string') throw new ServiceError(400, 'invalid_recovery_destination');
  const supplied = normalizeRecoveryDestination(selected, raw);
  const stored = typeof gift[selected === 'email' ? 'customerEmail' : 'customerWhatsapp'] === 'string'
    ? normalizeRecoveryDestination(selected, gift[selected === 'email' ? 'customerEmail' : 'customerWhatsapp']) : '';
  if (!supplied || !stored || supplied !== stored) throw new ServiceError(404, 'recovery_not_found');
  return supplied;
}

/** Creates a pending recovery record, then asks the injected provider to deliver it. */
export async function issueGuestEditRecovery(
  env: Env,
  input: { giftId: unknown; channel: unknown; destination: unknown },
  siteOrigin: string,
  provider: RecoveryDeliveryProvider | null,
) {
  const selected = channel(input.channel);
  if (!selected || !validGiftId(String(input.giftId))) return { ok: false as const, status: 400, code: 'invalid_recovery_request' };
  if (!provider) return { ok: false as const, status: 503, code: 'recovery_provider_not_configured' };
  const giftId = String(input.giftId);
  const pending = await guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await tx.get(`gifts/${giftId}`);
    if (!gift || gift.status === 'deleted') throw new ServiceError(404, 'recovery_not_found');
    const supplied = destination(gift, selected, input.destination);
    const identityHash = hashRecoveryDestination(selected, supplied);
    const limited = await consumeRateLimit(tx, 'guest-recovery-request', identityHash, env.nowMs(), RECOVERY_POLICY);
    if (!limited.ok) throw new ServiceError(429, 'rate_limited', String(Math.ceil(limited.retryAfterMs / 1000)));
    const token = createRecoveryToken();
    const recoveryHash = hashRecoveryToken(token);
    const now = env.ts(env.nowMs());
    tx.create(`guestEditRecoveries/${recoveryHash}`, {
      giftId, ownerUid: gift.ownerUid, channel: selected, destinationHash: identityHash,
      status: 'pending', createdAt: now, expiresAt: env.ts(env.nowMs() + RECOVERY_TTL_MS), usedAt: null, schemaVersion: 1,
    });
    return { recoveryHash, token, destination: supplied, channel: selected };
  }));
  if (!pending.ok) return pending;
  const recoveryUrl = `${siteOrigin.replace(/\/$/, '')}/recover/edit?token=${encodeURIComponent(pending.token)}`;
  try {
    await provider.send({ channel: pending.channel, destination: pending.destination, recoveryUrl });
    await env.store.runTransaction(async (tx) => {
      const record = await tx.get(`guestEditRecoveries/${pending.recoveryHash}`);
      if (!record) throw new ServiceError(404, 'recovery_not_found');
      tx.update(`guestEditRecoveries/${pending.recoveryHash}`, { status: 'sent', sentAt: env.ts(env.nowMs()) });
    });
    return { ok: true as const, deliveryAccepted: true };
  } catch {
    await env.store.runTransaction(async (tx) => {
      const record = await tx.get(`guestEditRecoveries/${pending.recoveryHash}`);
      if (record) tx.update(`guestEditRecoveries/${pending.recoveryHash}`, { status: 'delivery_failed', failedAt: env.ts(env.nowMs()) });
    }).catch(() => undefined);
    return { ok: false as const, status: 503, code: 'recovery_delivery_failed' };
  }
}

/** Redeems a sent recovery once and rotates the gift edit token; plaintext is returned once. */
export function redeemGuestEditRecovery(env: Env, rawToken: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    if (typeof rawToken !== 'string' || rawToken.length < 32) throw new ServiceError(404, 'recovery_not_found');
    const recoveryHash = hashRecoveryToken(rawToken);
    const record = await tx.get(`guestEditRecoveries/${recoveryHash}`);
    if (!record || record.status !== 'sent' || record.usedAt || typeof record.expiresAt?.toMillis !== 'function' || env.nowMs() >= record.expiresAt.toMillis()) throw new ServiceError(404, 'recovery_not_found');
    const giftId = typeof record.giftId === 'string' ? record.giftId : '';
    const gift = giftId ? await tx.get(`gifts/${giftId}`) : null;
    if (!gift || gift.ownerUid !== record.ownerUid || gift.status === 'deleted') throw new ServiceError(404, 'recovery_not_found');
    const editToken = createEditToken();
    const nowMs = env.nowMs();
    tx.update(`gifts/${giftId}`, { editTokenHash: hashEditToken(editToken), editTokenExpiresAt: env.ts(nowMs + GUEST_EDIT_DAYS * 86_400_000), updatedAt: env.ts(nowMs) });
    tx.update(`guestEditRecoveries/${recoveryHash}`, { status: 'redeemed', usedAt: env.ts(nowMs) });
    return { giftId, editToken };
  }));
}
