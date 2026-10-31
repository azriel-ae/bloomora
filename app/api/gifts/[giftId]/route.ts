import { withActor } from '@/lib/server/http';
import { deleteGift, getGiftDraft, saveDraft } from '@/lib/server/services';
import { lookupTemplate } from '@/lib/server/template-lookup';

type Ctx = { params: Promise<{ giftId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { giftId } = await params;
  return withActor(request, (env, actor) => getGiftDraft(env, actor, giftId), { body: false, editorDev: true });
}

/** Saves the private draft only. It can never change what the public sees. */
export async function PUT(request: Request, { params }: Ctx) {
  const { giftId } = await params;
  return withActor(request, (env, actor, b) =>
    saveDraft(env, actor, giftId, { expectedVersion: b.expectedVersion, content: b.content, templateId: b.templateId }, lookupTemplate), { editorDev: true });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { giftId } = await params;
  return withActor(request, (env, actor) => deleteGift(env, actor, giftId), { body: false, editorDev: true });
}
