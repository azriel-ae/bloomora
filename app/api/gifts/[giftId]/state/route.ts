import { withActor } from '@/lib/server/http';
import { archiveGift, unarchiveGift } from '@/lib/server/services';

export async function POST(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  return withActor(request, async (env, actor, b) => {
    if (b.action === 'archive') return archiveGift(env, actor, giftId);
    if (b.action === 'unarchive') return unarchiveGift(env, actor, giftId);
    return { ok: false, status: 400, code: 'invalid_action' } as const;
  });
}
