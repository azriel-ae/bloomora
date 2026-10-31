import { withActor } from '@/lib/server/http';
import { createGift } from '@/lib/server/services';
import { lookupTemplate } from '@/lib/server/template-lookup';

export async function POST(request: Request) {
  return withActor(request, (env, actor, b) => createGift(env, actor, { templateId: b.templateId, content: b.content }, lookupTemplate), { editorDev: true });
}
