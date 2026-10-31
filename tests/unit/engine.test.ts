import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_TEMPLATE_VERSIONS, createRegistry, listCatalog, searchCatalog, getFeaturedDemo, getActiveTemplate, getTemplateForRender } from '../../lib/engine/registry.ts';
import { validateTemplateConfig, EMOJI_LIKE } from '../../lib/engine/validate-config.ts';
import { resolveRenderModel, sampleContent, blankContent, validateContentForTemplate, missingForPublish } from '../../lib/engine/resolve.ts';
import { contrastRatio } from '../../lib/engine/color.ts';
import { chapterOfUs } from '../../lib/engine/templates/chapter-of-us.ts';
import { validateGiftContent } from '../../lib/model/content.ts';
import type { TemplateConfig } from '../../lib/engine/types.ts';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

test('QUALITY GATE: every registered template passes config validation', () => {
  assert.ok(ALL_TEMPLATE_VERSIONS.length >= 4);
  for (const t of ALL_TEMPLATE_VERSIONS) assert.deepEqual(validateTemplateConfig(t), [], t.id);
});

test('template ids are unique per version and sample content passes the generic content validator', () => {
  const keys = ALL_TEMPLATE_VERSIONS.map((t) => `${t.id}@${t.version}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const t of ALL_TEMPLATE_VERSIONS) for (const loc of ['en', 'id'] as const) {
    const c = sampleContent(t, loc);
    assert.equal(validateGiftContent(c).ok, true, `${t.id}/${loc}`);
    assert.equal(validateContentForTemplate(t, c), null, `${t.id}/${loc}`);
    assert.deepEqual(missingForPublish(t, c), [], `${t.id}/${loc}`);
  }
});

test('config validator catches the defects it exists to catch', () => {
  const bad = (mut: (t: TemplateConfig) => void) => { const t = clone(chapterOfUs); mut(t); return validateTemplateConfig(t); };
  assert.ok(bad((t) => { t.name.en = 'Chapter of Us \u2661'; }).some((e) => e.includes('emoji-like')));
  assert.ok(bad((t) => { t.sample.en.fields.signature = 'Arga \u{1F496}'; }).some((e) => e.includes('emoji-like')));
  assert.ok(bad((t) => { t.sections[1].variant = 'rainbow'; }).some((e) => e.includes('unsupported variant')));
  assert.ok(bad((t) => { t.tagline.id = ''; }).some((e) => e.includes('missing id text')));
  assert.ok(bad((t) => { t.theme.palette.ink = '#9a8f88'; }).some((e) => e.includes('ink/background')));
  assert.ok(bad((t) => { t.sections[2].fields[0].key = 'title'; }).some((e) => e.includes('duplicate key')));
  assert.ok(bad((t) => { t.sections.pop(); }).some((e) => e.includes('closing')));
  assert.ok(bad((t) => { delete t.sample.id.fields.signature; }).some((e) => e.includes('differ between en and id') || e.includes('missing required')));
  assert.ok(bad((t) => { t.sample.id.lists.reasons.pop(); }).some((e) => e.includes('list sizes differ')));
  assert.ok(bad((t) => { t.sections[3].lists[0].itemFields[2].maxLength = 5; }).some((e) => e.includes('exceeds maxLength')));
  assert.ok(bad((t) => { t.status = 'inactive'; }).some((e) => e.includes('demo template must be active')));
});

test('emoji detector flags pictographs and dingbats but allows normal typography', () => {
  for (const s of ['\u2661', '\u2733', '\u2709', '\u2766', '\u{1F338}', '\u2764\uFE0F']) assert.equal(EMOJI_LIKE.test(s), true, s);
  for (const s of ['Rp19.000', 'caf\u00e9', 'Arga \u2014 Maya', '\u201cquoted\u201d', '\u2026', 'No. 5 \u2022 item']) assert.equal(EMOJI_LIKE.test(s), false, s);
});

test('contrast helper matches known WCAG values', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01);
  assert.ok(Math.abs(contrastRatio('#777777', '#ffffff') - 4.48) < 0.05);
});

test('render model: sample content produces every non-media section in template order, none empty', () => {
  const m = resolveRenderModel(chapterOfUs, sampleContent(chapterOfUs, 'en'));
  assert.deepEqual(m.sections.map((s) => s.id), ['opening', 'hero', 'letter', 'timeline', 'gallery', 'message', 'appreciation', 'closing']);
  assert.equal(m.hasAudio, false);
  assert.equal(m.sections.find((s) => s.id === 'timeline')!.lists.chapters.length, 5);
  assert.equal(m.sections.find((s) => s.id === 'opening')!.variant, 'sealed-letter');
  for (const s of m.sections) assert.ok(Object.values(s.fields).some(Boolean) || Object.values(s.lists).some((l) => l.length));
});

test('render model: blank gift renders nothing; sample text only appears when explicitly requested', () => {
  assert.equal(resolveRenderModel(chapterOfUs, blankContent(chapterOfUs)).sections.length, 0);
  const own = { ...blankContent(chapterOfUs), fields: { recipientName: 'Lina', senderName: 'Bo' } };
  const real = resolveRenderModel(chapterOfUs, own);
  assert.deepEqual(real.sections.map((s) => s.id), ['opening']);
  assert.equal(real.sections[0].fields.occasion, '', 'a real gift never shows sample text');
  const preview = resolveRenderModel(chapterOfUs, own, { fillEmptyFrom: 'id' });
  assert.equal(preview.sections[0].fields.recipientName, 'Lina');
  assert.equal(preview.sections[0].fields.occasion, 'Tiga tahun bersama');
  assert.ok(preview.sections.length > 1);
});

test('render model: optional sections can be switched off; audio section needs audio and content', () => {
  const c = sampleContent(chapterOfUs, 'en');
  const off = { ...c, sections: c.sections.filter((s) => s !== 'appreciation') };
  assert.equal(resolveRenderModel(chapterOfUs, off).sections.some((s) => s.id === 'appreciation'), false);
  const withAudio = { ...c, sections: [...c.sections.slice(0, -1), 'music', 'closing'], fields: { ...c.fields, trackTitle: 'Quiet Hours' }, media: [{ id: 'a1', kind: 'audio' as const, path: 'private/u/gifts/g/a1.mp3' }] };
  const m = resolveRenderModel(chapterOfUs, withAudio);
  assert.equal(m.hasAudio, true);
  assert.deepEqual(m.sections.map((s) => s.id).slice(-2), ['music', 'closing']);
  const noAudioFile = { ...withAudio, media: [] };
  assert.equal(resolveRenderModel(chapterOfUs, noAudioFile).sections.some((s) => s.id === 'music'), false);
});

test('render model tolerates hostile or malformed content without throwing and truncates to limits', () => {
  const evil = {
    fields: { recipientName: 'x'.repeat(500), senderName: 42 as unknown as string },
    sections: ['opening'], media: [],
    data: { chapters: [null, 'str', { when: 'now', title: { a: 1 }, text: 'ok' }, ...Array(30).fill({ when: 'w', title: 't', text: 'x' })] },
  };
  const m = resolveRenderModel(chapterOfUs, evil as never);
  assert.equal(m.sections[0].fields.recipientName.length, 40);
  assert.equal(m.sections[0].fields.senderName, '');
});

test('content-vs-template validation: unknown keys, limits, section rules', () => {
  const ok = sampleContent(chapterOfUs, 'en');
  assert.equal(validateContentForTemplate(chapterOfUs, ok), null);
  const v = (mut: (c: ReturnType<typeof sampleContent>) => void) => { const c = clone(ok); mut(c); return validateContentForTemplate(chapterOfUs, c); };
  assert.equal(v((c) => { c.fields.injected = 'x'; }), 'unknown_field:injected');
  assert.equal(v((c) => { c.fields.title = 'x'.repeat(61); }), 'field_too_long:title');
  assert.equal(v((c) => { c.sections.push('ghost'); }), 'unknown_section:ghost');
  assert.equal(v((c) => { c.sections = c.sections.filter((s) => s !== 'letter'); }), 'required_section_missing:letter');
  assert.equal(v((c) => { c.sections = [...c.sections].reverse(); }), 'section_order');
  assert.equal(v((c) => { c.sections.push('opening'); }), 'duplicate_section');
  assert.equal(v((c) => { c.data.extra = []; }), 'unknown_list:extra');
  assert.equal(v((c) => { c.data.chapters = Array(8).fill({ when: 'a' }); }), 'list_size:chapters');
  assert.equal(v((c) => { c.data.chapters = [{ when: 'a', hidden: 'x' }]; }), 'unknown_list_field:chapters.hidden');
  assert.equal(v((c) => { c.data.chapters = [{ when: 5 }]; }), 'list_field_invalid:chapters.when');
  assert.equal(v((c) => { c.data.reasons = [{ text: 'x'.repeat(161) }]; }), 'list_field_invalid:reasons.text');
});

test('publish completeness: drafts may be incomplete, publications may not', () => {
  assert.deepEqual(missingForPublish(chapterOfUs, blankContent(chapterOfUs)).map((m) => m.key).sort(),
    ['appreciationText', 'chapters', 'closingLine', 'letterBody', 'moments', 'reasons', 'recipientName', 'senderName', 'signature', 'title']);
  const c = sampleContent(chapterOfUs, 'id');
  c.data.chapters = [{ when: '2024', title: '', text: '' }, { when: '', title: '', text: '' }];
  assert.deepEqual(missingForPublish(chapterOfUs, c), [{ kind: 'list', key: 'chapters' }]);
  const noAppreciation = { ...sampleContent(chapterOfUs, 'en') };
  noAppreciation.fields.appreciationText = '';
  assert.deepEqual(missingForPublish(chapterOfUs, noAppreciation).map((m) => m.key), ['appreciationText']);
  noAppreciation.sections = noAppreciation.sections.filter((s) => s !== 'appreciation');
  assert.deepEqual(missingForPublish(chapterOfUs, noAppreciation), []);
});

test('catalog: only active templates listed; search by name/description in either language; category filter', () => {
  assert.deepEqual(listCatalog().map((t) => t.id).sort(), ['chapter-of-us', 'just-a-letter', 'our-little-archive', 'pressed-garden']);
  assert.deepEqual(searchCatalog('bab', 'id').map((t) => t.id), ['chapter-of-us']);
  assert.deepEqual(searchCatalog('BOTANICAL', 'en').map((t) => t.id), ['pressed-garden']);
  assert.deepEqual(searchCatalog('', 'en', 'friendship').map((t) => t.id), ['our-little-archive']);
  assert.deepEqual(searchCatalog('zzzz', 'en'), []);
  assert.equal(getFeaturedDemo()?.id, 'chapter-of-us');
  assert.equal(listCatalog().filter((t) => t.featured && t.hasDemo).length, 1, 'exactly one featured demo');
});

test('MODEL B: deactivating or revising a template never changes how an existing gift renders', () => {
  const v2 = clone(chapterOfUs); v2.version = 2; v2.theme.palette.accent = '#1f4d3a'; v2.status = 'active';
  const retiredV1 = clone(chapterOfUs); retiredV1.status = 'inactive'; retiredV1.hasDemo = false; retiredV1.featured = false;
  const reg = createRegistry([retiredV1, v2]);
  assert.equal(reg.getActiveTemplate('chapter-of-us')!.version, 2);
  assert.equal(reg.getTemplateForRender('chapter-of-us', 1)!.theme.palette.accent, '#8a2f3c', 'v1 gifts keep the v1 look');

  const allGone = createRegistry([{ ...retiredV1 }]);
  assert.equal(allGone.getActiveTemplate('chapter-of-us'), null, 'cannot be used for new gifts');
  assert.equal(allGone.listCatalog().length, 0, 'hidden from the catalog');
  assert.equal(allGone.getTemplateForRender('chapter-of-us', 1)!.id, 'chapter-of-us', 'still renders existing gifts');
  assert.equal(getTemplateForRender('chapter-of-us', 1)!.version, 1);
  assert.equal(getActiveTemplate('nope'), null);
});

test('renaming layout never touches content: a v2 that drops a field simply ignores it', () => {
  const v2 = clone(chapterOfUs); v2.version = 2;
  v2.sections = v2.sections.map((s) => s.id === 'hero' ? { ...s, fields: s.fields.filter((f) => f.key !== 'dateLine') } : s);
  const c = sampleContent(chapterOfUs, 'en');
  const m = resolveRenderModel(v2, c);
  assert.equal('dateLine' in m.sections.find((s) => s.id === 'hero')!.fields, false);
  assert.equal(c.fields.dateLine.length > 0, true, 'the saved content still holds the text');
});
