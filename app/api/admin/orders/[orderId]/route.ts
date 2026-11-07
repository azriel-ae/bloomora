import { withActor } from '@/lib/server/http';
import { approveOrder, deleteAdminOrder, getAdminOrderDetail, rejectOrder } from '@/lib/server/services';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** Admin-only. Authorization is re-checked inside the service from the verified token claim. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, async (env, actor, b) => {
    if (b.decision === 'approve') return approveOrder(env, actor, orderId);
    if (b.decision === 'reject') return rejectOrder(env, actor, orderId, b.reason);
    return { ok: false, status: 400, code: 'invalid_decision' } as const;
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, (env, actor) => getAdminOrderDetail(env, actor, orderId), { body: false });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, async (env, actor) => {
    const deleted = await deleteAdminOrder(env, actor, orderId);
    if (!deleted.ok) return deleted;
    let storageCleanupIncomplete = false;
    const storage = createSupabaseAdminClient();
    const tasks: Promise<void>[] = [];
    if (deleted.proofPath) {
      if (!storage) storageCleanupIncomplete = true;
      else tasks.push(storage.storage.from('payment-proofs').remove([deleted.proofPath]).then(({ error }) => { if (error) storageCleanupIncomplete = true; }));
    }
    if (deleted.mediaPaths.length > 0) {
      if (!storage) storageCleanupIncomplete = true;
      else tasks.push(storage.storage.from('gift-media').remove(deleted.mediaPaths).then(({ error }) => { if (error) storageCleanupIncomplete = true; }));
    }
    await Promise.all(tasks);
    if (storageCleanupIncomplete) console.error('[admin-order-delete] Storage cleanup incomplete; database links and media references have already been deleted.');
    return { ok: true, giftDeleted: deleted.giftDeleted, storageCleanupIncomplete };
  }, { body: false });
}
