import 'server-only';
import type { Actor } from './services.ts';
import type { Env } from './store.ts';
import { ServiceError } from './store.ts';
import { getActiveTemplate, listCatalog } from '../engine/registry.ts';

const SETTING_ID = 'featured_demo';
function fallbackId(): string {
  return getActiveTemplate('chapter-of-us')?.id ?? listCatalog()[0]?.id ?? 'chapter-of-us';
}

/** Returns only an active catalog template; stale or unavailable values safely fall back. */
export async function getFeaturedDemoId(env: Env): Promise<string> {
  try {
    return await env.store.runTransaction(async (tx) => {
      const row = await tx.get(`siteSettings/${SETTING_ID}`);
      const value = row?.value as Record<string, unknown> | undefined;
      const id = typeof value?.templateId === 'string' ? value.templateId : '';
      return getActiveTemplate(id) ? id : fallbackId();
    });
  } catch {
    return fallbackId();
  }
}

export async function saveFeaturedDemo(env: Env, actor: Actor, input: unknown) {
  return env.store.runTransaction(async (tx) => {
    if (!actor.admin) throw new ServiceError(403, 'admin_required');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ServiceError(400, 'invalid_body');
    const templateId = (input as Record<string, unknown>).templateId;
    if (typeof templateId !== 'string' || !getActiveTemplate(templateId)) throw new ServiceError(400, 'invalid_featured_template');
    const now = env.ts(env.nowMs());
    tx.set(`siteSettings/${SETTING_ID}`, { value: { templateId }, updatedAt: now, updatedBy: actor.uid, schemaVersion: 1 });
    tx.create(`adminAuditLogs/${env.newId()}`, { action: 'featured_demo.update', actorUid: actor.uid, at: now, templateId });
    return { templateId };
  });
}
