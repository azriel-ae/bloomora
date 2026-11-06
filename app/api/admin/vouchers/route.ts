import { deleteVoucher, listAdminVouchers, saveVoucher } from '@/lib/server/services';
import { withActor } from '@/lib/server/http';

export async function GET(request: Request) {
  return withActor(request, (env, actor) => listAdminVouchers(env, actor), { body: false });
}

export async function PUT(request: Request) {
  return withActor(request, (env, actor, body) => saveVoucher(env, actor, body));
}

export async function DELETE(request: Request) {
  return withActor(request, (env, actor, body) => deleteVoucher(env, actor, body.code));
}
