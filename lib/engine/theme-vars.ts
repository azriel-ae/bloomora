import type { SectionType, Theme } from './types.ts';
import { FONT_STACKS } from './fonts.ts';

/** CSS custom properties for a theme. The whole experience is styled from these tokens only. */
export function themeVars(theme: Theme): Record<string, string> {
  const p = theme.palette;
  return {
    '--bl-bg': p.background, '--bl-surface': p.surface, '--bl-ink': p.ink, '--bl-muted': p.mutedInk,
    '--bl-accent': p.accent, '--bl-accent-ink': p.accentInk, '--bl-line': p.line,
    '--bl-display': FONT_STACKS[theme.display], '--bl-body': FONT_STACKS[theme.body],
  };
}

/**
 * Variants the React renderer actually implements. The config schema allows more (they are
 * reserved for upcoming templates); a variant not listed here falls back to the type's first
 * implemented variant instead of rendering nothing. A template with a demo must only use
 * implemented variants (enforced by a test).
 */
export const IMPLEMENTED_VARIANTS: Record<SectionType, readonly string[]> = {
  opening: ['sealed-letter'], hero: ['editorial-title'], letter: ['folio'], timeline: ['vertical-chapters'],
  gallery: ['plates'], message: ['reasons-deck'], appreciation: ['quiet-note'], music: ['quiet-player'], closing: ['signature'],
};
export function effectiveVariant(type: SectionType, variant: string): string {
  return IMPLEMENTED_VARIANTS[type].includes(variant) ? variant : IMPLEMENTED_VARIANTS[type][0];
}
