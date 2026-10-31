import type { GiftContent } from './types.ts';
import { MEDIA_UPLOAD_ENABLED } from '../features.ts';

/** Server-side validation for gift content. Plain JSON data only; no HTML is ever trusted. */
export const CONTENT_LIMITS = {
  maxFields: 30, maxFieldValue: 4000, maxSections: 12, maxSectionId: 60,
  maxDataBytes: 60_000, maxDepth: 6, maxArray: 200, maxObjectKeys: 100,
} as const;

export type ContentResult = { ok: true; content: GiftContent } | { ok: false; code: 'invalid_content' | 'media_unavailable'; detail: string };
const bad = (detail: string): ContentResult => ({ ok: false, code: 'invalid_content', detail });
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

function jsonSafe(value: unknown, depth: number): string | null {
  if (depth > CONTENT_LIMITS.maxDepth) return 'too deep';
  if (value === null || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'non-finite number';
  if (typeof value === 'string') return value.length <= CONTENT_LIMITS.maxFieldValue ? null : 'string too long';
  if (Array.isArray(value)) {
    if (value.length > CONTENT_LIMITS.maxArray) return 'array too long';
    for (const v of value) { const e = jsonSafe(v, depth + 1); if (e) return e; }
    return null;
  }
  if (typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return 'not a plain object';
    const keys = Object.keys(value as object);
    if (keys.length > CONTENT_LIMITS.maxObjectKeys) return 'too many keys';
    for (const k of keys) {
      if (FORBIDDEN_KEYS.has(k)) return 'forbidden key';
      const e = jsonSafe((value as Record<string, unknown>)[k], depth + 1); if (e) return e;
    }
    return null;
  }
  return 'unsupported type';
}

export function validateGiftContent(input: unknown, opts: { mediaEnabled?: boolean } = {}): ContentResult {
  const mediaEnabled = opts.mediaEnabled ?? MEDIA_UPLOAD_ENABLED;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return bad('content must be an object');
  const c = input as Record<string, unknown>;

  if (typeof c.fields !== 'object' || c.fields === null || Array.isArray(c.fields)) return bad('fields must be an object');
  const entries = Object.entries(c.fields as Record<string, unknown>);
  if (entries.length > CONTENT_LIMITS.maxFields) return bad('too many fields');
  const fields: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!KEY.test(k) || FORBIDDEN_KEYS.has(k)) return bad(`invalid field name: ${k}`);
    if (typeof v !== 'string' || v.length > CONTENT_LIMITS.maxFieldValue) return bad(`invalid field value: ${k}`);
    fields[k] = v;
  }

  if (!Array.isArray(c.sections) || c.sections.length > CONTENT_LIMITS.maxSections) return bad('invalid sections');
  const sections: string[] = [];
  for (const s of c.sections) {
    if (typeof s !== 'string' || !s.trim() || s.length > CONTENT_LIMITS.maxSectionId) return bad('invalid section id');
    sections.push(s);
  }

  const data = c.data ?? {};
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return bad('data must be an object');
  const dataErr = jsonSafe(data, 0);
  if (dataErr) return bad(`data: ${dataErr}`);
  if (JSON.stringify(data).length > CONTENT_LIMITS.maxDataBytes) return bad('data too large');

  const mediaIn = c.media ?? [];
  if (!Array.isArray(mediaIn)) return bad('media must be an array');
  if (mediaIn.length > 0 && !mediaEnabled) return { ok: false, code: 'media_unavailable', detail: 'media upload is not available yet' };
  const media: GiftContent['media'] = [];
  for (const m of mediaIn) {
    const r = m as Record<string, unknown>;
    if (typeof r?.id !== 'string' || (r.kind !== 'image' && r.kind !== 'audio') || typeof r.path !== 'string'
      || r.path.length > 300 || r.path.includes('..') || !r.path.startsWith('private/')) return bad('invalid media entry');
    media.push({ id: r.id, kind: r.kind, path: r.path });
  }
  return { ok: true, content: { fields, sections, data: data as Record<string, unknown>, media } };
}
