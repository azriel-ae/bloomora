/**
 * Original SVG plates for the gallery. Each plate is plain data (shapes in a
 * 400 x 500 box using theme tones), so it recolours with any template palette,
 * needs no image files, and can be validated by tests. They are abstract
 * editorial scenes: no text, no figures, no emoji. Real photographs replace
 * them later when Storage exists; until then (or when an image fails to load)
 * a plate is what the gallery shows.
 */
export type Tone = 'bg' | 'surface' | 'ink' | 'muted' | 'accent' | 'line';
export const TONE_VAR: Record<Tone, string> = {
  bg: '--bl-bg', surface: '--bl-surface', ink: '--bl-ink', muted: '--bl-muted', accent: '--bl-accent', line: '--bl-line',
};
export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; tone: Tone; o?: number; stroke?: number; rx?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; tone: Tone; o?: number; stroke?: number }
  | { t: 'path'; d: string; tone: Tone; o?: number; stroke?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; tone: Tone; o?: number; stroke: number };
export interface Plate { id: string; shapes: Shape[] }
export const PLATE_W = 400;
export const PLATE_H = 500;

const wave = (y: number, amp: number) => `M-20 ${y} Q30 ${y - amp} 80 ${y} T180 ${y} T280 ${y} T380 ${y} T480 ${y}`;
const rain = Array.from({ length: 18 }, (_, i): Shape => {
  const x1 = 34 + ((i * 37) % 330); const y1 = 36 + ((i * 71) % 300);
  return { t: 'line', x1, y1, x2: x1 - 9, y2: y1 + 30, tone: 'surface', o: 0.85, stroke: 2 };
});
const stars = [[70, 70, 2.5], [130, 130, 2], [200, 60, 3], [340, 200, 2], [60, 220, 2], [250, 170, 2.5], [110, 300, 2]].map(([cx, cy, r]): Shape => ({ t: 'circle', cx, cy, r, tone: 'surface', o: 0.75 }));
const balusters = Array.from({ length: 11 }, (_, i): Shape => ({ t: 'line', x1: 24 + i * 35, y1: 366, x2: 24 + i * 35, y2: 452, tone: 'surface', o: 0.55, stroke: 3 }));
const cardRules = [176, 206, 236, 266, 296, 326].map((y): Shape => ({ t: 'line', x1: 84, y1: y, x2: 316, y2: y, tone: 'line', stroke: 2 }));

export const PLATES: readonly Plate[] = [
  { id: 'bridge', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'line', o: 0.5 },
    { t: 'circle', cx: 290, cy: 130, r: 46, tone: 'accent', o: 0.88 },
    { t: 'rect', x: 0, y: 290, w: 400, h: 18, tone: 'ink', o: 0.92 },
    { t: 'path', d: 'M10 392 A60 78 0 0 1 130 392', tone: 'ink', stroke: 9 },
    { t: 'path', d: 'M140 392 A60 78 0 0 1 260 392', tone: 'ink', stroke: 9 },
    { t: 'path', d: 'M270 392 A60 78 0 0 1 390 392', tone: 'ink', stroke: 9 },
    { t: 'rect', x: 0, y: 392, w: 400, h: 108, tone: 'line', o: 0.7 },
    { t: 'line', x1: 60, y1: 414, x2: 340, y2: 414, tone: 'accent', o: 0.55, stroke: 2 },
    { t: 'line', x1: 100, y1: 438, x2: 300, y2: 438, tone: 'accent', o: 0.42, stroke: 2 },
    { t: 'line', x1: 140, y1: 462, x2: 260, y2: 462, tone: 'accent', o: 0.3, stroke: 2 },
  ] },
  { id: 'recipe', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'line', o: 0.55 },
    { t: 'rect', x: 56, y: 70, w: 288, h: 360, tone: 'surface' },
    { t: 'line', x1: 84, y1: 116, x2: 250, y2: 116, tone: 'ink', stroke: 4 },
    { t: 'path', d: 'M84 146 q15 -14 30 0 t30 0 t30 0 t30 0 t30 0 t30 0', tone: 'ink', o: 0.6, stroke: 2.5 },
    ...cardRules,
    { t: 'circle', cx: 280, cy: 372, r: 28, tone: 'accent', o: 0.55, stroke: 3 },
  ] },
  { id: 'rain', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'muted', o: 0.38 },
    ...rain,
    { t: 'path', d: 'M80 262 A120 120 0 0 1 320 262 Q290 242 260 262 Q230 242 200 262 Q170 242 140 262 Q110 242 80 262 Z', tone: 'accent', o: 0.92 },
    { t: 'path', d: 'M200 262 V392 a22 22 0 0 1 -44 0', tone: 'ink', stroke: 6 },
  ] },
  { id: 'hilltop', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'surface' },
    { t: 'circle', cx: 200, cy: 190, r: 78, tone: 'accent', o: 0.9 },
    { t: 'path', d: 'M0 330 Q100 250 200 310 T400 290 V500 H0 Z', tone: 'muted', o: 0.9 },
    { t: 'path', d: 'M0 410 Q140 340 260 400 T400 380 V500 H0 Z', tone: 'ink', o: 0.82 },
    { t: 'path', d: 'M196 500 Q208 452 244 414', tone: 'surface', o: 0.7, stroke: 4 },
  ] },
  { id: 'window', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'line', o: 0.42 },
    { t: 'rect', x: 94, y: 70, w: 212, h: 320, tone: 'surface' },
    { t: 'circle', cx: 156, cy: 150, r: 26, tone: 'accent', o: 0.88 },
    { t: 'circle', cx: 250, cy: 118, r: 3, tone: 'ink', o: 0.5 },
    { t: 'circle', cx: 262, cy: 188, r: 2.5, tone: 'ink', o: 0.5 },
    { t: 'rect', x: 94, y: 70, w: 212, h: 320, tone: 'ink', stroke: 8 },
    { t: 'line', x1: 200, y1: 70, x2: 200, y2: 390, tone: 'ink', stroke: 5 },
    { t: 'line', x1: 94, y1: 230, x2: 306, y2: 230, tone: 'ink', stroke: 5 },
    { t: 'rect', x: 72, y: 390, w: 256, h: 16, tone: 'ink' },
    { t: 'path', d: 'M58 56 Q104 200 70 440 L58 440 Z', tone: 'accent', o: 0.78 },
    { t: 'path', d: 'M342 56 Q296 200 330 440 L342 440 Z', tone: 'accent', o: 0.78 },
  ] },
  { id: 'balcony', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'ink' },
    { t: 'circle', cx: 290, cy: 120, r: 42, tone: 'surface' },
    { t: 'circle', cx: 275, cy: 110, r: 38, tone: 'ink' },
    ...stars,
    { t: 'line', x1: 0, y1: 366, x2: 400, y2: 366, tone: 'surface', stroke: 5 },
    ...balusters,
    { t: 'rect', x: 0, y: 452, w: 400, h: 48, tone: 'accent', o: 0.85 },
  ] },
  { id: 'path', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 250, tone: 'line', o: 0.4 },
    { t: 'rect', x: 0, y: 250, w: 400, h: 250, tone: 'surface' },
    { t: 'circle', cx: 112, cy: 214, r: 34, tone: 'muted', o: 0.8 },
    { t: 'circle', cx: 300, cy: 200, r: 46, tone: 'accent', o: 0.75 },
    { t: 'line', x1: 112, y1: 248, x2: 112, y2: 252, tone: 'ink', stroke: 3 },
    { t: 'path', d: 'M150 500 L250 500 L216 250 L184 250 Z', tone: 'line' },
    { t: 'line', x1: 150, y1: 500, x2: 184, y2: 250, tone: 'ink', o: 0.8, stroke: 3 },
    { t: 'line', x1: 250, y1: 500, x2: 216, y2: 250, tone: 'ink', o: 0.8, stroke: 3 },
    { t: 'line', x1: 0, y1: 250, x2: 400, y2: 250, tone: 'ink', stroke: 3 },
    { t: 'path', d: 'M200 496 L200 462 M200 440 L200 410 M200 392 L200 366 M200 350 L200 330', tone: 'accent', o: 0.7, stroke: 4 },
  ] },
  { id: 'waves', shapes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 500, tone: 'surface' },
    { t: 'circle', cx: 200, cy: 196, r: 62, tone: 'accent', o: 0.9 },
    { t: 'rect', x: 0, y: 220, w: 400, h: 280, tone: 'line', o: 0.7 },
    { t: 'path', d: wave(250, 14), tone: 'ink', o: 0.85, stroke: 3 },
    { t: 'path', d: wave(292, 18), tone: 'accent', o: 0.7, stroke: 3 },
    { t: 'path', d: wave(336, 16), tone: 'ink', o: 0.6, stroke: 3 },
    { t: 'path', d: wave(382, 20), tone: 'accent', o: 0.5, stroke: 3 },
    { t: 'path', d: wave(430, 18), tone: 'ink', o: 0.4, stroke: 3 },
  ] },
];

export function plateFor(index: number): Plate {
  return PLATES[((index % PLATES.length) + PLATES.length) % PLATES.length];
}
