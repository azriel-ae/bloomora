import { isValidCustomSlug, normalizeCustomSlug, generateSlug } from '../slug.ts';
import { createEditToken, guestOwnerId, hashEditToken, verifyEditToken } from '../security/edit-token.ts';
import { validateGiftContent } from '../model/content.ts';
import { ServiceError, guarded, type Doc, type Env, type Tx } from './store.ts';
import type { GiftContent } from '../model/types.ts';
import type { TemplateLookup } from './services.ts';

const GUEST_EDIT_DAYS = 30;
const contentOf = (input: unknown): GiftContent => {
  const result = validateGiftContent(input);
  if (!result.ok) throw new ServiceError(result.code === 'media_unavailable' ? 403 : 400, result.code, result.detail);
  return result.content;
};

async function reserveSlug(tx: Tx, requested: unknown, ownerUid: string, giftId: string, now: ReturnType<Env['ts']>): Promise<string> {
  const custom = normalizeCustomSlug(requested);
  if (requested !== undefined && (!isValidCustomSlug(custom) || custom !== String(requested).trim().toLowerCase())) {
    throw new ServiceError(400, 'invalid_custom_slug');
  }
  const candidates = custom ? [custom] : Array.from({ length: 6 }, () => generateSlug());
  for (const slug of candidates) {
    if (!isValidCustomSlug(slug) && !/^[a-z0-9]{12}$/.test(slug)) continue;
    if ((await tx.get(`slugs/${slug}`)) === null) {
      tx.create(`slugs/${slug}`, { giftId, ownerUid, createdAt: now });
      return slug;
    }
  }
  throw new ServiceError(custom ? 409 : 503, custom ? 'slug_unavailable' : 'slug_allocation_failed');
}

export function createGuestGift(env: Env, input: { templateId: unknown; content: unknown; customSlug?: unknown; email?: unknown; whatsapp?: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const template = typeof input.templateId === 'string' ? lookup(input.templateId) : null;
    if (!template) throw new ServiceError(400, 'unknown_template');
    const content = contentOf(input.content);
    const structuralError = template.validateContent?.(content);
    if (structuralError) throw new ServiceError(400, 'invalid_content', structuralError);
    const token = createEditToken();
    const ownerUid = guestOwnerId(token);
    const giftId = env.newId();
    const nowMs = env.nowMs();
    const now = env.ts(nowMs);
    const expiresAt = env.ts(nowMs + GUEST_EDIT_DAYS * 86_400_000);
    const slug = await reserveSlug(tx, input.customSlug, ownerUid, giftId, now);
    tx.create(`gifts/${giftId}`, {
      ownerUid, editTokenHash: hashEditToken(token), editTokenExpiresAt: expiresAt,
      customerEmail: typeof input.email === 'string' ? input.email.trim().slice(0, 200) : null,
      customerWhatsapp: typeof input.whatsapp === 'string' ? input.whatsapp.trim().slice(0, 40) : null,
      templateId: template.id, templateVersion: template.version, slug, status: 'draft',
      draft: { content, version: 1, updatedAt: now }, publishedRevision: null, publishedAt: null,
      createdUnderSubscriptionId: null, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null, schemaVersion: 2,
    });
    return { giftId, slug, version: 1, editToken: token, editTokenExpiresAtMs: nowMs + GUEST_EDIT_DAYS * 86_400_000 };
  }));
}

async function loadGuest(tx: Tx, env: Env, giftId: string, token: unknown): Promise<Doc> {
  const gift = await tx.get(`gifts/${giftId}`);
  if (!gift || !verifyEditToken(token, gift.editTokenHash)) throw new ServiceError(404, 'edit_link_invalid');
  const expiresAt = gift.editTokenExpiresAt?.toMillis?.();
  if (typeof expiresAt !== 'number' || env.nowMs() >= expiresAt) throw new ServiceError(403, 'edit_link_expired');
  if (gift.status === 'deleted') throw new ServiceError(404, 'gift_deleted');
  return gift;
}

export function getGuestGiftDraft(env: Env, giftId: string, token: unknown) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await loadGuest(tx, env, giftId, token);
    return { giftId, slug: gift.slug, templateId: gift.templateId, templateVersion: gift.templateVersion, status: gift.status,
      draft: { content: contentOf(gift.draft.content), version: gift.draft.version, updatedAtMs: gift.draft.updatedAt?.toMillis?.() ?? env.nowMs() }, editable: true,
      entitlement: { state: 'guest_draft' as const, expiresAtMs: gift.editTokenExpiresAt.toMillis() } };
  }));
}

export function saveGuestGiftDraft(env: Env, giftId: string, token: unknown, input: { expectedVersion: unknown; content: unknown }, lookup: TemplateLookup) {
  return guarded(async () => env.store.runTransaction(async (tx) => {
    const gift = await loadGuest(tx, env, giftId, token);
    if (!Number.isInteger(input.expectedVersion) || gift.draft.version !== input.expectedVersion) throw new ServiceError(409, 'version_conflict', String(gift.draft.version));
    const content = contentOf(input.content);
    const template = lookup(String(gift.templateId), Number(gift.templateVersion));
    if (!template) throw new ServiceError(409, 'template_unavailable');
    const structuralError = template.validateContent?.(content);
    if (structuralError) throw new ServiceError(400, 'invalid_content', structuralError);
    const version = gift.draft.version + 1;
    const now = env.ts(env.nowMs());
    tx.update(`gifts/${giftId}`, { draft: { content, version, updatedAt: now }, updatedAt: now });
    return { version };
  }));
}
