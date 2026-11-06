import { withActor } from '@/lib/server/http';
import { getDashboardData } from '@/lib/server/services';

export async function GET(request: Request) {
  return withActor(request, (env, actor) => getDashboardData(env, actor), { body: false });
}
