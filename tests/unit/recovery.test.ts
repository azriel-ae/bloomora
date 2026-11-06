import assert from 'node:assert/strict';
import test from 'node:test';
import { hashEditToken, verifyEditToken } from '../../lib/security/edit-token.ts';
import { createRecoveryToken, hashRecoveryToken, verifyRecoveryToken } from '../../lib/security/recovery.ts';
import { issueGuestEditRecovery, redeemGuestEditRecovery } from '../../lib/server/recovery-services.ts';
import { createGuestGift } from '../../lib/server/guest-services.ts';
import * as services from '../../lib/server/services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const admin: services.Actor = { uid: 'owner', admin: true };
const lookup: services.TemplateLookup = (id) => id === 'pressed-garden' ? { id, tier: 'core', version: 1 } : null;
const content = { fields: { title: 'A small gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };

test('recovery tokens are high entropy, hashed at rest, and constant-time verified', () => {
  const token = createRecoveryToken();
  const hash = hashRecoveryToken(token);
  assert.equal(token.length >= 32, true);
  assert.equal(hash.length, 64);
  assert.equal(verifyRecoveryToken(token, hash), true);
  assert.equal(verifyRecoveryToken(`${token}x`, hash), false);
  assert.equal(hashEditToken(token) === hash, false);
});

test('recovery delivery is provider-injected, stores no destination, rotates edit token once, and rejects replay', async () => {
  const h = makeEnv(1_800_000_000_000);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content, email: 'Guest@Example.com', whatsapp: '+62 812-3456-7890' }, lookup);
  assert.ok(gift);
  if (!gift.ok) return;
  const deliveries: { channel: string; destination: string; recoveryUrl: string }[] = [];
  const provider = { send: async (payload: { channel: 'email' | 'whatsapp'; destination: string; recoveryUrl: string }) => { deliveries.push(payload); } };
  const issued = await issueGuestEditRecovery(h.env, { giftId: gift.giftId, channel: 'email', destination: ' guest@example.com ' }, 'https://bloomora.test', provider);
  assert.deepEqual(issued, { ok: true, deliveryAccepted: true });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].destination, 'guest@example.com');
  const token = new URL(deliveries[0].recoveryUrl).searchParams.get('token');
  assert.ok(token);
  const recoveryDocs = [...h.store.docs.entries()].filter(([path]) => path.startsWith('guestEditRecoveries/'));
  assert.equal(recoveryDocs.length, 1);
  assert.equal(JSON.stringify(recoveryDocs[0][1]).includes('guest@example.com'), false);
  const redeemed = await redeemGuestEditRecovery(h.env, token);
  assert.ok(redeemed.ok);
  if (!redeemed.ok) return;
  assert.equal(redeemed.giftId, gift.giftId);
  assert.equal(verifyEditToken(redeemed.editToken, h.store.docs.get(`gifts/${gift.giftId}`)!.editTokenHash), true);
  const replay = await redeemGuestEditRecovery(h.env, token);
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.code, 'recovery_not_found');
  const wrongDestination = await issueGuestEditRecovery(h.env, { giftId: gift.giftId, channel: 'email', destination: 'wrong@example.com' }, 'https://bloomora.test', provider);
  assert.equal(wrongDestination.ok, false);
  if (!wrongDestination.ok) assert.equal(wrongDestination.code, 'recovery_not_found');
});

test('recovery is fail-closed without a provider and throttles repeated requests by destination hash', async () => {
  const h = makeEnv(1_800_000_000_000);
  const gift = await createGuestGift(h.env, { templateId: 'pressed-garden', content, email: 'guest@example.com', whatsapp: '+62812345678' }, lookup);
  assert.ok(gift);
  if (!gift.ok) return;
  const noProvider = await issueGuestEditRecovery(h.env, { giftId: gift.giftId, channel: 'email', destination: 'guest@example.com' }, 'https://bloomora.test', null);
  assert.deepEqual([noProvider.ok, !noProvider.ok && noProvider.code], [false, 'recovery_provider_not_configured']);
  const provider = { send: async () => undefined };
  for (let i = 0; i < 3; i++) assert.equal((await issueGuestEditRecovery(h.env, { giftId: gift.giftId, channel: 'email', destination: 'guest@example.com' }, 'https://bloomora.test', provider)).ok, true);
  const limited = await issueGuestEditRecovery(h.env, { giftId: gift.giftId, channel: 'email', destination: 'guest@example.com' }, 'https://bloomora.test', provider);
  assert.deepEqual([limited.ok, !limited.ok && limited.code], [false, 'rate_limited']);
});
