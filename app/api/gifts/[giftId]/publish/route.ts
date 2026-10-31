import { withActor } from '@/lib/server/http';
import { publishGift } from '@/lib/server/services';
import { lookupTemplate } from '@/lib/server/template-lookup';

export async function POST(request: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  return withActor(request, (env, actor, b) => publishGift(env, actor, giftId, { expectedVersion: b.expectedVersion }, lookupTemplate));
}
