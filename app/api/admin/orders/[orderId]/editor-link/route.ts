import { withActor } from '@/lib/server/http';
import { createAdminCustomerEditorLink } from '@/lib/server/services';

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, (env, actor) => createAdminCustomerEditorLink(env, actor, orderId), { body: false });
}
