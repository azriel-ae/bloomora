import { listAdminPaymentMethods, savePaymentMethod } from '@/lib/server/services';
import { withActor } from '@/lib/server/http';

export async function GET(request: Request) {
  return withActor(request, (env, actor) => listAdminPaymentMethods(env, actor), { body: false });
}

export async function PUT(request: Request) {
  return withActor(request, (env, actor, body) => savePaymentMethod(env, actor, body));
}
