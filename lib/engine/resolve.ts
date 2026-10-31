import type { GiftContent } from '../model/types.ts';
import type { FieldDef, ListDef, Locale, RenderModel, RenderSection, SectionDef, TemplateConfig } from './types.ts';

/**
 * Content <-> template logic. Pure and deterministic.
 *
 * Content is keyed by stable field/list keys, never by position or layout, so
 * a template can change its design without touching saved content. Keys
 * removed in a later template version are simply ignored by the renderer; the
 * owner's text stays in the draft.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function topLevelFields(config: TemplateConfig): Map<string, FieldDef> {
  const m = new Map<string, FieldDef>();
  for (const s of config.sections) for (const f of s.fields) m.set(f.key, f);
  return m;
}
function allLists(config: TemplateConfig): Map<string, ListDef> {
  const m = new Map<string, ListDef>();
  for (const s of config.sections) for (const l of s.lists) m.set(l.key, l);
  return m;
}

/** Strict check used on save. Returns a short error string, or null when valid. */
export function validateContentForTemplate(config: TemplateConfig, content: GiftContent): string | null {
  const fields = topLevelFields(config);
  for (const [key, value] of Object.entries(content.fields)) {
    const def = fields.get(key);
    if (!def) return `unknown_field:${key}`;
    if (value.length > def.maxLength) return `field_too_long:${key}`;
  }

  const ids = config.sections.map((s) => s.id);
  const given = content.sections;
  if (new Set(given).size !== given.length) return 'duplicate_section';
  for (const id of given) if (!ids.includes(id)) return `unknown_section:${id}`;
  for (const s of config.sections) if (!s.optional && !given.includes(s.id) && !s.requiresMedia) return `required_section_missing:${s.id}`;
  // The narrative order belongs to the template; the owner can only switch optional sections on or off.
  const canonical = ids.filter((id) => given.includes(id));
  if (canonical.some((id, i) => given[i] !== id)) return 'section_order';

  const lists = allLists(config);
  for (const [key, raw] of Object.entries(content.data)) {
    const def = lists.get(key);
    if (!def) return `unknown_list:${key}`;
    if (!Array.isArray(raw) || raw.length > def.maxItems) return `list_size:${key}`;
    const itemKeys = new Map(def.itemFields.map((f) => [f.key, f]));
    for (const item of raw) {
      if (!isRecord(item)) return `list_item:${key}`;
      for (const [k, v] of Object.entries(item)) {
        const f = itemKeys.get(k);
        if (!f) return `unknown_list_field:${key}.${k}`;
        if (typeof v !== 'string' || v.length > f.maxLength) return `list_field_invalid:${key}.${k}`;
      }
    }
  }
  return null;
}

export type MissingItem = { kind: 'field' | 'list'; key: string };

/** What must still be filled before publishing. Drafts may be incomplete; publications may not. */
export function missingForPublish(config: TemplateConfig, content: GiftContent): MissingItem[] {
  const missing: MissingItem[] = [];
  for (const s of config.sections) {
    if (s.requiresMedia === 'audio' && !content.media.some((m) => m.kind === 'audio')) continue;
    if (s.optional && !content.sections.includes(s.id)) continue;
    for (const f of s.fields) if (f.required && !(content.fields[f.key] ?? '').trim()) missing.push({ kind: 'field', key: f.key });
    for (const l of s.lists) {
      const raw = content.data[l.key];
      const filled = Array.isArray(raw) ? raw.filter((it) => isRecord(it) && Object.values(it).some((v) => typeof v === 'string' && v.trim())).length : 0;
      if (filled < l.minItems) missing.push({ kind: 'list', key: l.key });
    }
  }
  return missing;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function resolveSection(config: TemplateConfig, s: SectionDef, content: GiftContent, fill: Locale | null): RenderSection | null {
  const sample = fill ? config.sample[fill] : null;
  const fields: Record<string, string> = {};
  for (const f of s.fields) {
    const own = str(content.fields[f.key]).slice(0, f.maxLength);
    fields[f.key] = own || (sample ? sample.fields[f.key] ?? '' : '');
  }
  const lists: Record<string, Record<string, string>[]> = {};
  for (const l of s.lists) {
    const raw = content.data[l.key];
    let items: Record<string, string>[] = [];
    if (Array.isArray(raw)) {
      items = raw.filter(isRecord).slice(0, l.maxItems).map((it) => {
        const out: Record<string, string> = {};
        for (const f of l.itemFields) out[f.key] = str(it[f.key]).slice(0, f.maxLength);
        return out;
      }).filter((it) => Object.values(it).some(Boolean));
    }
    if (!items.length && sample) items = (sample.lists[l.key] ?? []).slice(0, l.maxItems);
    lists[l.key] = items;
  }
  const empty = Object.values(fields).every((v) => !v) && Object.values(lists).every((l) => l.length === 0);
  return empty ? null : { id: s.id, type: s.type, variant: s.variant, fields, lists };
}

/**
 * Builds what the renderer draws. Never throws on odd content.
 * - Optional sections the owner switched off are omitted.
 * - Sections needing audio are omitted when no audio exists.
 * - Sections with no content are omitted, so no empty placeholder is ever shown.
 * - `fillEmptyFrom` substitutes the template's sample text for empty fields. It is used for demos and
 *   editor previews and must NEVER be set when rendering a real published gift.
 */
export function resolveRenderModel(
  config: TemplateConfig, content: GiftContent, opts: { fillEmptyFrom?: Locale | null } = {},
): RenderModel {
  const fill = opts.fillEmptyFrom ?? null;
  const hasAudio = content.media.some((m) => m.kind === 'audio');
  const sections: RenderSection[] = [];
  for (const s of config.sections) {
    if (s.requiresMedia === 'audio' && !hasAudio) continue;
    if (s.optional && !content.sections.includes(s.id)) continue;
    const r = resolveSection(config, s, content, fill);
    if (r) sections.push(r);
  }
  return { templateId: config.id, templateVersion: config.version, theme: config.theme, sections, hasAudio };
}

/** Complete sample content (demo, catalog preview). Optional audio sections are left out: there is no audio asset. */
export function sampleContent(config: TemplateConfig, locale: Locale): GiftContent {
  const s = config.sample[locale];
  return {
    fields: { ...s.fields },
    sections: config.sections.filter((x) => !x.requiresMedia).map((x) => x.id),
    data: Object.fromEntries(Object.entries(s.lists).map(([k, v]) => [k, v.map((it) => ({ ...it }))])),
    media: [],
  };
}

/** Empty content for a new gift: required sections on, optional sections on, nothing typed. */
export function blankContent(config: TemplateConfig): GiftContent {
  return { fields: {}, sections: config.sections.filter((x) => !x.requiresMedia).map((x) => x.id), data: {}, media: [] };
}
