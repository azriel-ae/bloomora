import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openingReducer, lightboxReducer, deckReducer, swipeDirection, activeIndex, scrollProgress, roman, pad2, type LightboxState,
} from '../../lib/engine/interaction.ts';
import { PLATES, plateFor, PLATE_W, PLATE_H, TONE_VAR, type Shape } from '../../lib/engine/plates.ts';
import { themeVars, IMPLEMENTED_VARIANTS, effectiveVariant } from '../../lib/engine/theme-vars.ts';
import { GIFT_LABEL_KEYS, fmt } from '../../lib/engine/labels.ts';
import { ALL_TEMPLATE_VERSIONS } from '../../lib/engine/registry.ts';
import { EMOJI_LIKE } from '../../lib/engine/validate-config.ts';
import { SECTION_VARIANTS } from '../../lib/engine/types.ts';
import { chapterOfUs } from '../../lib/engine/templates/chapter-of-us.ts';

test('opening: sealed -> opening -> leaving -> open; reduced motion jumps straight to open; no restarts', () => {
  let s = openingReducer('sealed', { type: 'begin', reducedMotion: false });
  assert.equal(s, 'opening');
  s = openingReducer(s, { type: 'advance' }); assert.equal(s, 'leaving');
  s = openingReducer(s, { type: 'advance' }); assert.equal(s, 'open');
  assert.equal(openingReducer('open', { type: 'advance' }), 'open');
  assert.equal(openingReducer('open', { type: 'begin', reducedMotion: false }), 'open');
  assert.equal(openingReducer('opening', { type: 'begin', reducedMotion: false }), 'opening');
  assert.equal(openingReducer('sealed', { type: 'begin', reducedMotion: true }), 'open');
  assert.equal(openingReducer('sealed', { type: 'advance' }), 'sealed');
});

test('lightbox: open, page with wraparound, goto, close, shrinking galleries', () => {
  let s: LightboxState = { open: false, index: 0, count: 6 };
  assert.deepEqual(lightboxReducer(s, { type: 'next' }), s, 'cannot page while closed');
  s = lightboxReducer(s, { type: 'open', index: 2 }); assert.deepEqual(s, { open: true, index: 2, count: 6 });
  s = lightboxReducer(s, { type: 'next' }); assert.equal(s.index, 3);
  s = lightboxReducer({ ...s, index: 5 }, { type: 'next' }); assert.equal(s.index, 0, 'wraps forward');
  s = lightboxReducer(s, { type: 'prev' }); assert.equal(s.index, 5, 'wraps backward');
  s = lightboxReducer(s, { type: 'goto', index: 99 }); assert.equal(s.index, 5, 'clamped');
  assert.equal(lightboxReducer(s, { type: 'open', index: -4 }).index, 0);
  s = lightboxReducer(s, { type: 'close' }); assert.equal(s.open, false);
  assert.equal(lightboxReducer({ open: true, index: 4, count: 6 }, { type: 'setCount', count: 3 }).index, 2);
  assert.deepEqual(lightboxReducer({ open: true, index: 1, count: 3 }, { type: 'setCount', count: 0 }), { open: false, index: 0, count: 0 });
  assert.equal(lightboxReducer({ open: false, index: 0, count: 0 }, { type: 'open', index: 0 }).open, false, 'empty gallery never opens');
});

test('swipe: needs distance and a mostly horizontal gesture', () => {
  assert.equal(swipeDirection(-80, 5), 'next');
  assert.equal(swipeDirection(80, -10), 'prev');
  assert.equal(swipeDirection(20, 0), null);
  assert.equal(swipeDirection(-60, 90), null, 'vertical scroll is not a swipe');
});

test('deck: toggle each card independently, open next, close all, resize', () => {
  let s = { open: [] as number[], count: 6 };
  s = deckReducer(s, { type: 'toggle', index: 3 }); assert.deepEqual(s.open, [3]);
  s = deckReducer(s, { type: 'toggle', index: 1 }); assert.deepEqual(s.open, [1, 3]);
  s = deckReducer(s, { type: 'toggle', index: 3 }); assert.deepEqual(s.open, [1], 'a card can be closed again');
  s = deckReducer(s, { type: 'openNext' }); assert.deepEqual(s.open, [0, 1]);
  s = deckReducer(s, { type: 'openNext' }); assert.deepEqual(s.open, [0, 1, 2]);
  assert.deepEqual(deckReducer(s, { type: 'toggle', index: 9 }), s, 'out of range ignored');
  assert.deepEqual(deckReducer(s, { type: 'closeAll' }).open, []);
  const full = { open: [0, 1, 2, 3, 4, 5], count: 6 };
  assert.deepEqual(deckReducer(full, { type: 'openNext' }), full, 'nothing left to open');
  assert.deepEqual(deckReducer(full, { type: 'setCount', count: 4 }).open, [0, 1, 2, 3]);
});

test('navigation helpers', () => {
  assert.equal(activeIndex([], 100), -1);
  assert.equal(activeIndex([500, 900], 100), 0, 'before the first section still reports the first');
  assert.equal(activeIndex([-300, -20, 400, 900], 100), 1);
  assert.equal(activeIndex([-300, -20, 40, 90], 100), 3);
  assert.equal(scrollProgress(0, 3000, 800), 0);
  assert.equal(scrollProgress(1100, 3000, 800), 0.5);
  assert.equal(scrollProgress(9999, 3000, 800), 1);
  assert.equal(scrollProgress(10, 500, 800), 0, 'non-scrollable page');
  assert.deepEqual([1, 2, 4, 6, 9, 10, 14].map(roman), ['I', 'II', 'IV', 'VI', 'IX', 'X', 'XIV']);
  assert.equal(pad2(3), '03');
});

test('plates: 8 distinct original compositions, in bounds, valid tones, no text, no emoji', () => {
  assert.ok(PLATES.length >= 8);
  assert.equal(new Set(PLATES.map((p) => p.id)).size, PLATES.length);
  const num = /-?\d+(\.\d+)?/g;
  for (const p of PLATES) {
    assert.ok(p.shapes.length >= 5, p.id);
    for (const s of p.shapes as Shape[]) {
      assert.ok(s.tone in TONE_VAR, `${p.id} tone`);
      if (s.o !== undefined) assert.ok(s.o > 0 && s.o <= 1);
      if (s.t === 'rect') assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= PLATE_W && s.y + s.h <= PLATE_H, `${p.id} rect in bounds`);
      if (s.t === 'circle') assert.ok(s.cx - s.r >= -1 && s.cx + s.r <= PLATE_W + 1 && s.cy - s.r >= -1 && s.cy + s.r <= PLATE_H + 1, `${p.id} circle in bounds`);
      if (s.t === 'line') assert.ok(s.x1 >= 0 && s.x2 <= PLATE_W && s.y1 >= 0 && s.y2 <= PLATE_H, `${p.id} line in bounds`);
      if (s.t === 'path') { assert.ok(/^[MLHVQTAZmlhvqtaz0-9 .,\-]+$/.test(s.d), `${p.id} path charset`); assert.ok((s.d.match(num) ?? []).every((n) => Math.abs(Number(n)) <= 520)); }
      assert.equal(EMOJI_LIKE.test(JSON.stringify(s)), false);
    }
  }
  assert.equal(plateFor(8).id, PLATES[0].id); assert.equal(plateFor(-1).id, PLATES.at(-1)!.id);
});

test('theme tokens and variant fallback', () => {
  const v = themeVars(chapterOfUs.theme);
  assert.equal(v['--bl-accent'], '#8a2f3c'); assert.ok(v['--bl-display'].includes('Bodoni'));
  assert.deepEqual(Object.keys(v).sort(), ['--bl-accent', '--bl-accent-ink', '--bl-bg', '--bl-body', '--bl-display', '--bl-ink', '--bl-line', '--bl-muted', '--bl-surface']);
  assert.equal(effectiveVariant('timeline', 'dated-ledger'), 'vertical-chapters', 'unimplemented variant falls back');
  assert.equal(effectiveVariant('timeline', 'vertical-chapters'), 'vertical-chapters');
  for (const [type, impl] of Object.entries(IMPLEMENTED_VARIANTS)) for (const x of impl) assert.ok(SECTION_VARIANTS[type as keyof typeof SECTION_VARIANTS].includes(x));
});

test('every template that ships a demo uses only variants the renderer implements', () => {
  for (const t of ALL_TEMPLATE_VERSIONS.filter((x) => x.hasDemo)) for (const s of t.sections) assert.ok(IMPLEMENTED_VARIANTS[s.type].includes(s.variant), `${t.id}:${s.id}:${s.variant}`);
});

test('gift labels: exact same keys in en and id, no empty values, placeholders match, no emoji', () => {
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8')).gift; const id = JSON.parse(readFileSync('messages/id.json', 'utf8')).gift;
  for (const m of [en, id]) { assert.deepEqual(Object.keys(m).sort(), [...GIFT_LABEL_KEYS].sort()); for (const v of Object.values(m) as string[]) { assert.ok(v.trim()); assert.equal(EMOJI_LIKE.test(v), false); } }
  for (const k of GIFT_LABEL_KEYS) assert.deepEqual((en[k].match(/\{\w+\}/g) ?? []).sort(), (id[k].match(/\{\w+\}/g) ?? []).sort(), k);
  assert.equal(fmt('{open} of {total}', { open: 2, total: 6 }), '2 of 6');
  assert.equal(fmt('{x}', {}), '{x}');
});
