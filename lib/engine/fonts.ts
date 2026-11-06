import type { FontKey } from './types.ts';

/** Font stacks per token. System fonts only: no network request, no layout shift from font loading. */
export const FONT_STACKS: Record<FontKey, string> = {
  'serif-classic': "Georgia, 'Times New Roman', serif",
  'serif-didone': "'Bodoni 72', Didot, 'Bodoni MT', 'Playfair Display', Georgia, serif",
  'serif-old': "'Palatino Linotype', Palatino, 'Book Antiqua', 'URW Palladio L', Georgia, serif",
  'sans-clean': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  typewriter: "'Courier New', Courier, 'Liberation Mono', monospace",
};
