import type { GiftContent } from './types.ts';

/**
 * Legacy gifts were written by the original PUT /api/gifts/[giftId] with ISO
 * string timestamps and no templateId. This module is a pure planner: it
 * reads a legacy document and says what to write. It never deletes fields,
 * and a doc that already has schemaVersion 2 is left untouched, so running a
 * migration twice is harmless.
 */

export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    const s = v.seconds ?? v._seconds;
    if (typeof s === 'number') return s * 1000 + Math.floor((v.nanoseconds ?? v._nanoseconds ?? 0) / 1e6);
  }
  return null;
}

export type LegacyGift = {
  ownerUid?: unknown; title?: unknown; recipientName?: unknown; message?: unknown; scenes?: unknown;
  status?: unknown; updatedAt?: unknown; createdAt?: unknown; schemaVersion?: unknown; templateId?: unknown;
};

export type MigrationPlan<T> =
  | { action: 'skip'; reason: 'already_v2' }
  | { action: 'invalid'; reason: 'missing_owner' | 'bad_status' }
  | {
      action: 'migrate';
      /** Fields to merge into the existing document. Legacy fields stay in place. */
      patch: {
        templateId: string | null; templateVersion: number; status: 'draft' | 'published' | 'archived';
        draft: { content: GiftContent; version: number; updatedAt: T };
        publishedRevision: null; publishedAt: null; createdUnderSubscriptionId: null;
        createdAt: T; updatedAt: T; archivedAt: null; deletedAt: null; schemaVersion: 2;
      };
      /** True when the legacy doc had no usable template; the editor must ask. */
      needsTemplateChoice: boolean;
      /** True when the legacy doc claimed to be published and needs a manual look. */
      legacyPublished: boolean;
    };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function planLegacyGiftMigration<T>(legacy: LegacyGift, makeTimestamp: (ms: number) => T, nowMs: number): MigrationPlan<T> {
  if (legacy.schemaVersion === 2) return { action: 'skip', reason: 'already_v2' };
  if (typeof legacy.ownerUid !== 'string' || !legacy.ownerUid) return { action: 'invalid', reason: 'missing_owner' };
  const status = legacy.status ?? 'draft';
  if (status !== 'draft' && status !== 'published' && status !== 'archived') return { action: 'invalid', reason: 'bad_status' };

  const updatedMs = toMillis(legacy.updatedAt) ?? nowMs;
  const createdMs = toMillis(legacy.createdAt) ?? updatedMs;
  const scenes = Array.isArray(legacy.scenes) ? legacy.scenes.filter((s): s is string => typeof s === 'string').slice(0, 12) : [];
  const templateId = typeof legacy.templateId === 'string' && legacy.templateId ? legacy.templateId : null;

  // A legacy "published" gift never had a published revision or a public document.
  // Do not pretend otherwise: it is demoted to draft and flagged for review.
  const legacyPublished = status === 'published';
  return {
    action: 'migrate',
    needsTemplateChoice: templateId === null,
    legacyPublished,
    patch: {
      templateId, templateVersion: 1, status: legacyPublished ? 'draft' : status,
      draft: {
        content: {
          fields: { title: str(legacy.title, 100), recipientName: str(legacy.recipientName, 80), message: str(legacy.message, 2000) },
          sections: scenes, data: {}, media: [],
        },
        version: 1, updatedAt: makeTimestamp(updatedMs),
      },
      publishedRevision: null, publishedAt: null, createdUnderSubscriptionId: null,
      createdAt: makeTimestamp(createdMs), updatedAt: makeTimestamp(updatedMs),
      archivedAt: null, deletedAt: null, schemaVersion: 2,
    },
  };
}
