import { contrastRatio } from './color.ts';
import { CATEGORIES } from './categories.ts';
import { SECTION_VARIANTS, type L10n, type Locale, type TemplateConfig } from './types.ts';

/**
 * Quality gate for template definitions. Every template (including the ones
 * added later) must pass. Returns a list of problems; empty means valid.
 */

/** Pictographs, dingbats and misc symbols are banned from template copy: no emoji or emoji-like glyphs. */
export const EMOJI_LIKE = /[\u2600-\u27BF\u{1F000}-\u{1FAFF}\uFE0F\u200D]/u;
const LOCALES: Locale[] = ['en', 'id'];

function collectStrings(config: TemplateConfig): string[] {
  const out: string[] = [];
  const l10n = (x: L10n) => { out.push(x.en, x.id); };
  l10n(config.name); l10n(config.tagline); l10n(config.description);
  for (const s of config.sections) {
    for (const f of s.fields) { l10n(f.label); if (f.hint) l10n(f.hint); }
    for (const l of s.lists) { l10n(l.label); l10n(l.itemLabel); for (const f of l.itemFields) { l10n(f.label); if (f.hint) l10n(f.hint); } }
  }
  for (const loc of LOCALES) {
    out.push(...Object.values(config.sample[loc].fields));
    for (const items of Object.values(config.sample[loc].lists)) for (const it of items) out.push(...Object.values(it));
  }
  return out;
}

export function validateTemplateConfig(config: TemplateConfig): string[] {
  const p: string[] = [];
  const id = config.id;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) p.push(`${id}: id must be kebab-case`);
  if (!Number.isInteger(config.version) || config.version < 1) p.push(`${id}: version must be a positive integer`);
  if (!CATEGORIES.some((c) => c.id === config.category)) p.push(`${id}: unknown category`);

  // Both languages complete everywhere.
  const l10ns: [string, L10n][] = [['name', config.name], ['tagline', config.tagline], ['description', config.description]];
  for (const s of config.sections) {
    for (const f of s.fields) l10ns.push([`${s.id}.${f.key}.label`, f.label]);
    for (const l of s.lists) { l10ns.push([`${s.id}.${l.key}.label`, l.label], [`${s.id}.${l.key}.itemLabel`, l.itemLabel]); for (const f of l.itemFields) l10ns.push([`${s.id}.${l.key}.${f.key}.label`, f.label]); }
  }
  for (const [where, t] of l10ns) for (const loc of LOCALES) if (!t[loc]?.trim()) p.push(`${id}: missing ${loc} text at ${where}`);

  for (const s of collectStrings(config)) if (EMOJI_LIKE.test(s)) p.push(`${id}: emoji-like glyph in "${s.slice(0, 40)}"`);

  // Palette: readable text, usable accent.
  const pal = config.theme.palette;
  try {
    if (contrastRatio(pal.ink, pal.background) < 7) p.push(`${id}: ink/background contrast below 7:1`);
    if (contrastRatio(pal.ink, pal.surface) < 7) p.push(`${id}: ink/surface contrast below 7:1`);
    if (contrastRatio(pal.mutedInk, pal.background) < 4.5) p.push(`${id}: mutedInk/background contrast below 4.5:1`);
    if (contrastRatio(pal.mutedInk, pal.surface) < 4.5) p.push(`${id}: mutedInk/surface contrast below 4.5:1`);
    if (contrastRatio(pal.accentInk, pal.accent) < 4.5) p.push(`${id}: accentInk/accent contrast below 4.5:1`);
    if (contrastRatio(pal.accent, pal.background) < 3) p.push(`${id}: accent/background contrast below 3:1`);
  } catch (e) { p.push(`${id}: ${(e as Error).message}`); }

  // Sections and keys.
  const sectionIds = new Set<string>(); const keys = new Set<string>();
  for (const s of config.sections) {
    if (sectionIds.has(s.id)) p.push(`${id}: duplicate section id ${s.id}`); sectionIds.add(s.id);
    if (!SECTION_VARIANTS[s.type]?.includes(s.variant)) p.push(`${id}: section ${s.id} has unsupported variant ${s.variant} for ${s.type}`);
    for (const k of [...s.fields.map((f) => f.key), ...s.lists.map((l) => l.key)]) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) p.push(`${id}: invalid key ${k}`);
      if (keys.has(k)) p.push(`${id}: duplicate key ${k}`); keys.add(k);
    }
    for (const f of s.fields) if (f.maxLength < 1 || f.maxLength > 4000) p.push(`${id}: bad maxLength on ${f.key}`);
    for (const l of s.lists) {
      if (l.minItems < 0 || l.maxItems < Math.max(1, l.minItems) || l.maxItems > 20) p.push(`${id}: bad item bounds on ${l.key}`);
      for (const f of l.itemFields) if (f.maxLength < 1 || f.maxLength > 2000) p.push(`${id}: bad maxLength on ${l.key}.${f.key}`);
    }
    if (s.requiresMedia && !s.optional) p.push(`${id}: media-dependent section ${s.id} must be optional`);
  }
  if (config.sections.length === 0) p.push(`${id}: no sections`);
  if (config.sections.length > 12) p.push(`${id}: too many sections`);
  if (config.sections[0] && !['opening', 'hero'].includes(config.sections[0].type)) p.push(`${id}: must begin with an opening or hero`);
  if (config.sections.at(-1)?.type !== 'closing') p.push(`${id}: must end with a closing section`);

  // Sample content: complete, within limits, identical shape in both languages, no empty placeholders.
  const shape = (loc: Locale) => ({
    fields: Object.keys(config.sample[loc].fields).sort().join(','),
    lists: Object.entries(config.sample[loc].lists).map(([k, v]) => `${k}:${v.length}`).sort().join(','),
  });
  if (shape('en').fields !== shape('id').fields) p.push(`${id}: sample field keys differ between en and id`);
  if (shape('en').lists !== shape('id').lists) p.push(`${id}: sample list sizes differ between en and id`);
  for (const loc of LOCALES) {
    const sample = config.sample[loc];
    for (const s of config.sections) {
      if (s.requiresMedia) continue;
      for (const f of s.fields) {
        const v = sample.fields[f.key];
        if (f.required && !v?.trim()) p.push(`${id}/${loc}: sample missing required field ${f.key}`);
        if (v && v.length > f.maxLength) p.push(`${id}/${loc}: sample ${f.key} exceeds maxLength`);
      }
      for (const l of s.lists) {
        const items = sample.lists[l.key] ?? [];
        if (items.length < l.minItems || items.length > l.maxItems) p.push(`${id}/${loc}: sample ${l.key} has ${items.length} items, expected ${l.minItems}-${l.maxItems}`);
        for (const it of items) for (const f of l.itemFields) if ((it[f.key] ?? '').length > f.maxLength) p.push(`${id}/${loc}: sample ${l.key}.${f.key} exceeds maxLength`);
      }
    }
    const known = new Set(config.sections.flatMap((s) => [...s.fields.map((f) => f.key)]));
    for (const k of Object.keys(sample.fields)) if (!known.has(k)) p.push(`${id}/${loc}: sample has unknown field ${k}`);
  }
  if (config.hasDemo && config.status !== 'active') p.push(`${id}: a demo template must be active`);
  return p;
}
