import { listAdminOrders } from '@/lib/server/services';
import { withActor } from '@/lib/server/http';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return withActor(request, (env, actor) => listAdminOrders(env, actor, {
    status: url.searchParams.get('status') ?? undefined,
    packageId: url.searchParams.get('packageId') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  }), { body: false });
}
