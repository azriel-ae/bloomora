import { withActor } from '@/lib/server/http';
import { approveOrder, rejectOrder } from '@/lib/server/services';

/** Admin-only. Authorization is re-checked inside the service from the verified token claim. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, async (env, actor, b) => {
    if (b.decision === 'approve') return approveOrder(env, actor, orderId);
    if (b.decision === 'reject') return rejectOrder(env, actor, orderId, b.reason);
    return { ok: false, status: 400, code: 'invalid_decision' } as const;
  });
}
