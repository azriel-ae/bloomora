import { withActor } from '@/lib/server/http';
import { getQrisDisplay, saveQrisDisplay } from '@/lib/server/services';

export async function GET(request: Request) {
  return withActor(request, (env) => getQrisDisplay(env), { body: false });
}

export async function PUT(request: Request) {
  return withActor(request, (env, actor, body) => saveQrisDisplay(env, actor, body));
}
