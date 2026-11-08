import { withActor } from '@/lib/server/http';
import { getFeaturedDemoId, saveFeaturedDemo } from '@/lib/server/featured-demo';
import { guarded } from '@/lib/server/store';

function settingsFailure(error: unknown) {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = typeof value?.code === 'string' ? value.code : '';
  const message = typeof value?.message === 'string' ? value.message : '';
  if (code === '42P01' || /site_settings.*does not exist|relation .*site_settings/i.test(message)) {
    return { ok: false as const, status: 503, code: 'featured_demo_schema_missing' };
  }
  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    return { ok: false as const, status: 403, code: 'featured_demo_access_denied' };
  }
  return { ok: false as const, status: 503, code: 'featured_demo_save_failed' };
}

export async function GET(request: Request) {
  return withActor(request, async (env, actor) => {
    if (!actor.admin) return { ok: false, status: 403, code: 'admin_required' };
    return { ok: true, templateId: await getFeaturedDemoId(env) };
  }, { body: false });
}

export async function PUT(request: Request) {
  return withActor(request, async (env, actor, body) => {
    try {
      return await guarded(async () => saveFeaturedDemo(env, actor, body));
    } catch (error) {
      // Do not return or log connection strings, SQL parameters, or user data.
      console.error('[featured-demo] save unavailable', (error as { code?: unknown } | null)?.code ?? 'unknown');
      return settingsFailure(error);
    }
  });
}
