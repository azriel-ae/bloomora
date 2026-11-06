import assert from 'node:assert/strict';
import test from 'node:test';
import * as services from '../../lib/server/services.ts';
import { makeEnv } from './helpers/fake-store.ts';

const buyer: services.Actor = { uid: 'buyer', admin: false };
const admin: services.Actor = { uid: 'owner', admin: true };

test('admin order detail is restricted, proof gates review, and rejection reason is audited', async () => {
  const h = makeEnv(1_800_000_000_000);
  const created = await services.createOrder(h.env, buyer, 'plus');
  assert.ok(created.ok);
  if (!created.ok) return;

  const denied = await services.getAdminOrderDetail(h.env, buyer, created.orderId);
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, 'admin_required']);
  const detail = await services.getAdminOrderDetail(h.env, admin, created.orderId);
  assert.ok(detail.ok);
  if (!detail.ok) return;
  assert.equal(detail.order.status, 'awaiting_payment');
  assert.equal(detail.order.proof, null);
  assert.equal(detail.order.canReview, false);
  assert.deepEqual(detail.audit, []);

  h.store.docs.set(`orders/${created.orderId}`, { ...h.store.docs.get(`orders/${created.orderId}`)!, status: 'proof_submitted' });
  const approveWithoutProof = await services.approveOrder(h.env, admin, created.orderId);
  assert.deepEqual([approveWithoutProof.ok, !approveWithoutProof.ok && approveWithoutProof.code], [false, 'proof_required']);
  const rejectWithoutProof = await services.rejectOrder(h.env, admin, created.orderId, 'No readable proof');
  assert.deepEqual([rejectWithoutProof.ok, !rejectWithoutProof.ok && rejectWithoutProof.code], [false, 'proof_required']);
  assert.equal([...h.store.docs.keys()].some((key) => key.startsWith('subscriptions/')), false);

  h.store.docs.set(`orders/${created.orderId}`, { ...h.store.docs.get(`orders/${created.orderId}`)!, proof: { storagePath: `private/orders/${created.orderId}/receipt.png`, contentType: 'image/png', sizeBytes: 2048, submittedAt: h.env.ts(h.env.nowMs()) } });
  const rejected = await services.rejectOrder(h.env, admin, created.orderId, 'Bukti tidak menampilkan nominal transaksi.');
  assert.ok(rejected.ok);
  const after = await services.getAdminOrderDetail(h.env, admin, created.orderId);
  assert.ok(after.ok);
  if (after.ok) {
    assert.equal(after.order.status, 'rejected');
    assert.equal(after.order.canReview, false);
    assert.equal(after.order.rejectionReason, 'Bukti tidak menampilkan nominal transaksi.');
    assert.equal(after.order.proof?.available, true);
    assert.equal(JSON.stringify(after.order).includes('private/orders/'), false);
    assert.equal(after.audit.length, 1);
    assert.equal(after.audit[0]?.reason, 'Bukti tidak menampilkan nominal transaksi.');
  }
});
