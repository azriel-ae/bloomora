import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { Sql } from 'postgres';
import * as services from '../../lib/server/services.ts';
import { createGuestGift, createGuestOrder, getGuestGiftDraft, getGuestOrderDetail, getGuestOrderOwnerForProof, resolveGuestEditToken, submitGuestPaymentProof, validateGuestVoucher } from '../../lib/server/guest-services.ts';
import { verifyEditToken } from '../../lib/security/edit-token.ts';
import { postgresStore } from '../../lib/server/postgres-store.ts';
import type { Env } from '../../lib/server/store.ts';

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id text primary key, bucket_id text not null, name text not null);
  alter table storage.objects enable row level security;
`;

function pgliteSql(database: PGlite): Sql {
  type TestRowList = Array<Record<string, unknown>> & { count: number };
  const compatible = {
    begin: async <T>(callback: (transaction: { unsafe: (query: string, params?: never[]) => Promise<TestRowList> }) => Promise<T>) => {
      await database.exec('begin');
      try {
        const result = await callback({
          unsafe: async (query, params = []) => {
            const response = await database.query(query, params);
            const rows = response.rows as unknown as TestRowList;
            Object.defineProperty(rows, 'count', { value: response.affectedRows ?? rows.length, configurable: true });
            return rows;
          },
        });
        await database.exec('commit');
        return result;
      } catch (error) {
        await database.exec('rollback').catch(() => undefined);
        throw error;
      }
    },
  };
  return compatible as unknown as Sql;
}

async function createDatabase() {
  const database = new PGlite();
  await database.exec(bootstrapSql);
  for (const path of [
    'supabase/migrations/20261103000100_initial_schema.sql',
    'supabase/migrations/20261104000100_customer_media_storage.sql',
    'supabase/migrations/20261104000200_payment_method_details.sql',
    'supabase/migrations/20261104000300_payment_method_authenticated_management.sql',
    'supabase/migrations/20261104000400_order_soft_delete.sql',
    'supabase/migrations/20261105000100_slug_reservation_lifecycle.sql',
    'supabase/migrations/20261105000200_payment_proof_ai_review.sql',
  ]) await database.exec(await readFile(resolve(process.cwd(), path), 'utf8'));
  return database;
}

test('PostgreSQL Store runs guest checkout flows on real SQL transactions and maps domain documents', async () => {
  const database = await createDatabase();
  try {
    const store = postgresStore(pgliteSql(database));
    let id = 0;
    let nowMs = 1_800_000_000_000;
    const env: Env = {
      store,
      nowMs: () => nowMs,
      ts: (ms) => ({ toMillis: () => ms }),
      newId: () => `integration_${++id}`,
    };
    const actor: services.Actor = { uid: 'owner-test', admin: true };
    const lookup: services.TemplateLookup = (templateId) => templateId === 'pressed-garden' ? { id: templateId, tier: 'core', version: 1 } : null;
    const content = { fields: { title: 'A gift', message: 'For you' }, sections: ['Opening', 'Letter'], data: {}, media: [] };

    const configuredMethod = await services.savePaymentMethod(env, actor, {
      id: 'qris', name: 'QRIS', instructions: 'Pay using the QR code.', active: true, sortOrder: 1,
    });
    assert.equal(configuredMethod.ok, true);
    const configuredVoucher = await services.saveVoucher(env, actor, {
      code: 'ONEUSE', active: true, discount: { kind: 'percent', value: 10 },
      startsAtMs: null, expiresAtMs: null, maxUses: 1, minimumAmountIdr: 0,
    });
    assert.equal(configuredVoucher.ok, true);

    const gift = await createGuestGift(env, { templateId: 'pressed-garden', content }, lookup);
    assert.equal(gift.ok, true);
    if (!gift.ok) return;
    const committedGiftIds = await database.query<{ id: string }>('select id from public.gifts');
    assert.deepEqual(committedGiftIds.rows.map((row) => row.id), [gift.giftId]);
    const storedGift = await store.runTransaction((tx) => tx.get(`gifts/${gift.giftId}`));
    assert.ok(storedGift);
    assert.equal(verifyEditToken(gift.editToken, storedGift.editTokenHash), true);
    const voucherPreview = await validateGuestVoucher(env, { giftId: gift.giftId, editToken: gift.editToken, packageId: 'basic', voucherCode: 'ONEUSE' });
    assert.equal(voucherPreview.ok, true, JSON.stringify(voucherPreview));
    if (voucherPreview.ok) assert.equal(voucherPreview.discountIdr, 1900);
    await store.runTransaction(async (tx) => { tx.create('giftMedia/media_test', {
      giftId: gift.giftId, ownerUid: storedGift.ownerUid, kind: 'image', storagePath: `private/${gift.giftId}/media_test.jpg`,
      contentType: 'image/jpeg', sizeBytes: 4, createdAt: env.ts(nowMs), deletedAt: null, schemaVersion: 1,
    }); });
    const mediaMetadata = await store.runTransaction((tx) => tx.get('giftMedia/media_test'));
    assert.deepEqual([mediaMetadata?.giftId, mediaMetadata?.kind, mediaMetadata?.storagePath, mediaMetadata?.sizeBytes], [gift.giftId, 'image', `private/${gift.giftId}/media_test.jpg`, 4]);
    const resolvedEditLink = await resolveGuestEditToken(env, gift.editToken);
    assert.equal(resolvedEditLink.ok, true);
    if (resolvedEditLink.ok) assert.equal(resolvedEditLink.giftId, gift.giftId);

    const input = {
      giftId: gift.giftId,
      editToken: gift.editToken,
      idempotencyKey: 'a'.repeat(64),
      packageId: 'basic',
      email: 'guest@example.com',
      whatsapp: '+62812345678',
      paymentMethodId: 'qris',
      voucherCode: 'ONEUSE',
    };
    const first = await createGuestOrder(env, input);
    assert.equal(first.ok, true, JSON.stringify(first));
    if (!first.ok) return;
    assert.equal(first.status, 'awaiting_payment');

    const privateDetail = await getGuestOrderDetail(env, first.orderId, first.orderAccessToken);
    assert.equal(privateDetail.ok, true);
    if (!privateDetail.ok) return;
    assert.equal(privateDetail.order.paymentMethod.name, 'QRIS');
    assert.equal(privateDetail.order.amountIdr, first.amountIdr);

    const replay = await createGuestOrder(env, input);
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.orderId, first.orderId);
    assert.notEqual(replay.orderAccessToken, first.orderAccessToken);

    const replayDetail = await getGuestOrderDetail(env, replay.orderId, replay.orderAccessToken);
    assert.equal(replayDetail.ok, true);
    const secondGift = await createGuestGift(env, { templateId: 'pressed-garden', content }, lookup);
    assert.equal(secondGift.ok, true);
    if (!secondGift.ok) return;
    const secondVoucherOrder = await createGuestOrder(env, {
      ...input, giftId: secondGift.giftId, editToken: secondGift.editToken, idempotencyKey: 'b'.repeat(64),
    });
    assert.equal(secondVoucherOrder.ok, false);
    if (!secondVoucherOrder.ok) assert.deepEqual([secondVoucherOrder.status, secondVoucherOrder.code], [400, 'voucher_usage_limit']);
    const listedVouchers = await services.listAdminVouchers(env, actor);
    assert.equal(listedVouchers.ok, true);
    if (listedVouchers.ok) assert.equal(listedVouchers.vouchers[0].code, 'ONEUSE');

    const owner = await getGuestOrderOwnerForProof(env, first.orderId, replay.orderAccessToken);
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    const proof = await submitGuestPaymentProof(env, first.orderId, replay.orderAccessToken, {
      storagePath: `paymentProofs/${owner.ownerUid}/${first.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 1024, fileSha256: 'a'.repeat(64),
    });
    assert.equal(proof.ok, true);
    const approval = await services.approveOrder(env, actor, first.orderId);
    assert.equal(approval.ok, true);
    if (approval.ok) {
      nowMs += 40 * 86_400_000;
      const deletion = await services.deleteAdminOrder(env, actor, first.orderId);
      assert.equal(deletion.ok, true);
      const deletedOrder = await store.runTransaction((tx) => tx.get(`orders/${first.orderId}`));
      assert.equal(deletedOrder?.status, 'approved');
      assert.ok(deletedOrder?.deletedAt);
      assert.equal(deletedOrder?.subscriptionId, approval.subscriptionId);
      assert.equal(deletedOrder?.voucherCode, 'ONEUSE');
      assert.equal(deletedOrder?.proof?.storagePath, `paymentProofs/${owner.ownerUid}/${first.orderId}/receipt.png`);
      assert.ok(await store.runTransaction((tx) => tx.get(`subscriptions/${approval.subscriptionId}`)));
      assert.ok(await store.runTransaction((tx) => tx.get(`gifts/${gift.giftId}`)));
      const deleteAudit = await store.runTransaction((tx) => tx.query('adminAuditLogs', 'orderId', first.orderId));
      assert.equal(deleteAudit.some((row) => row.data.action === 'order.delete'), true);
    }
    const stored = await database.query<{ status: string; order_access_token_hash: string; user_id: string }>(
      'select status, order_access_token_hash, user_id from public.orders where id = $1', [first.orderId],
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].status, 'approved');
    assert.ok(stored.rows[0].order_access_token_hash);
    assert.ok(stored.rows[0].user_id.startsWith('guest_'));

    const rateLimits = await database.query<{ count: number }>('select count from public.rate_limits');
    assert.ok(rateLimits.rows.length >= 1);
    assert.ok(rateLimits.rows.every((row) => Number(row.count) >= 1));
  } finally {
    await database.close();
  }
});
