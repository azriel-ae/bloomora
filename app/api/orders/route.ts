import { withActor } from '@/lib/server/http';
import { createOrder } from '@/lib/server/services';

export async function POST(request: Request) {
  return withActor(request, (env, actor, b) => createOrder(env, actor, b.packageId));
}
