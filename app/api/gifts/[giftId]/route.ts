import { withActor } from '@/lib/server/http';
import { deleteGift, saveDraft } from '@/lib/server/services';
import { lookupTemplate } from '@/lib/server/template-lookup';

type Ctx = { params: Promise<{ giftId: string }> };

/** Saves the private draft only. It can never change what the public sees. */
export async function PUT(request: Request, { params }: Ctx) {
  const { giftId } = await params;
  return withActor(request, (env, actor, b) =>
    saveDraft(env, actor, giftId, { expectedVersion: b.expectedVersion, content: b.content, templateId: b.templateId }, lookupTemplate));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { giftId } = await params;
  return withActor(request, (env, actor) => deleteGift(env, actor, giftId), { body: false });
}
