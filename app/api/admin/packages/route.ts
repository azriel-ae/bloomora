import { listAdminPackages, savePackage } from '@/lib/server/services';
import { withActor } from '@/lib/server/http';

export async function GET(request: Request) {
  return withActor(request, (env, actor) => listAdminPackages(env, actor), { body: false });
}

export async function PUT(request: Request) {
  return withActor(request, (env, actor, body) => savePackage(env, actor, body));
}
