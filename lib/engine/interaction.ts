/**
 * Pure interaction state for the gift experience. The React components only
 * dispatch into these reducers, so every behaviour (lightbox paging, card deck,
 * opening sequence, active chapter, swipe) is unit-tested without a browser.
 */

/* ---- Opening sequence: sealed -> opening -> leaving -> open ---- */
export type OpeningState = 'sealed' | 'opening' | 'leaving' | 'open';
export type OpeningAction = { type: 'begin'; reducedMotion: boolean } | { type: 'advance' };
export function openingReducer(s: OpeningState, a: OpeningAction): OpeningState {
  if (a.type === 'begin') return s === 'sealed' ? (a.reducedMotion ? 'open' : 'opening') : s;
  if (s === 'opening') return 'leaving';
  if (s === 'leaving') return 'open';
  return s;
}
/** Timings (ms) of the sealed-letter animation. Reduced motion skips them entirely. */
export const OPENING_MS = { opening: 1100, leaving: 650 } as const;

/* ---- Lightbox ---- */
export interface LightboxState { open: boolean; index: number; count: number }
export type LightboxAction =
  | { type: 'open'; index: number } | { type: 'close' } | { type: 'next' } | { type: 'prev' }
  | { type: 'goto'; index: number } | { type: 'setCount'; count: number };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function lightboxReducer(s: LightboxState, a: LightboxAction): LightboxState {
  switch (a.type) {
    case 'setCount': return a.count <= 0 ? { open: false, index: 0, count: 0 } : { ...s, count: a.count, index: clamp(s.index, 0, a.count - 1) };
    case 'open': return s.count === 0 ? s : { ...s, open: true, index: clamp(a.index, 0, s.count - 1) };
    case 'close': return { ...s, open: false };
    case 'goto': return s.open ? { ...s, index: clamp(a.index, 0, s.count - 1) } : s;
    case 'next': return s.open && s.count ? { ...s, index: (s.index + 1) % s.count } : s;
    case 'prev': return s.open && s.count ? { ...s, index: (s.index - 1 + s.count) % s.count } : s;
  }
}

/** Horizontal swipe -> navigation. Ignores short or mostly vertical gestures (those are scrolling). */
export function swipeDirection(dx: number, dy: number, min = 48): 'next' | 'prev' | null {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.2) return null;
  return dx < 0 ? 'next' : 'prev';
}

/* ---- Reasons deck ---- */
export interface DeckState { open: number[]; count: number }
export type DeckAction = { type: 'toggle'; index: number } | { type: 'openNext' } | { type: 'closeAll' } | { type: 'setCount'; count: number };
export function deckReducer(s: DeckState, a: DeckAction): DeckState {
  switch (a.type) {
    case 'setCount': return { count: a.count, open: s.open.filter((i) => i < a.count) };
    case 'toggle':
      if (a.index < 0 || a.index >= s.count) return s;
      return { ...s, open: s.open.includes(a.index) ? s.open.filter((i) => i !== a.index) : [...s.open, a.index].sort((x, y) => x - y) };
    case 'openNext': {
      for (let i = 0; i < s.count; i++) if (!s.open.includes(i)) return { ...s, open: [...s.open, i].sort((x, y) => x - y) };
      return s;
    }
    case 'closeAll': return { ...s, open: [] };
  }
}

/* ---- Story navigation ---- */
/** Index of the section the reader is in: the last one whose top has passed `line`. */
export function activeIndex(tops: number[], line: number): number {
  if (!tops.length) return -1;
  let idx = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) idx = i;
  return idx;
}
export function scrollProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const range = scrollHeight - clientHeight;
  return range <= 0 ? 0 : clamp(scrollTop / range, 0, 1);
}
const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = ''; let rest = Math.max(0, Math.floor(n));
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out || '0';
}
export const pad2 = (n: number) => String(n).padStart(2, '0');
