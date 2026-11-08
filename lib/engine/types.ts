import type { GiftContent, TemplateTier } from '../model/types.ts';

/**
 * Template engine types. A template is DATA: theme tokens, an ordered list of
 * sections (each with a type and visual variant), the editable fields/lists
 * those sections consume, and complete sample content in both languages.
 * One shared renderer turns (config + content) into the page, so the editor,
 * demo, preview and public gift page all use the same code path.
 */

export type Locale = 'en' | 'id';
export type L10n = Record<Locale, string>;

export type CategoryId =
  | 'birthday' | 'anniversary' | 'friendship' | 'graduation' | 'thank-you'
  | 'long-distance' | 'appreciation' | 'just-because' | 'wedding' | 'family'
  | 'romantic-love' | 'birthday-celebration' | 'apology-appreciation'
  | 'family-friendship' | 'graduation-achievement' | 'special-moments' | 'holiday-seasonal';

export type SectionType =
  | 'opening' | 'hero' | 'letter' | 'gallery' | 'timeline'
  | 'message' | 'appreciation' | 'music' | 'closing';

/** System font stacks only (no network font dependency). Mapped to CSS in the renderer. */
export type FontKey = 'serif-classic' | 'serif-didone' | 'serif-old' | 'sans-clean' | 'typewriter';

export interface Palette {
  background: string; // page
  surface: string;    // cards, letter paper
  ink: string;        // primary text
  mutedInk: string;   // secondary text
  accent: string;     // fills, rules, active states
  accentInk: string;  // text placed on accent
  line: string;       // hairlines
}

export interface Theme {
  palette: Palette;
  display: FontKey;
  body: FontKey;
  /** 'none' honours reduced motion and disables transitions entirely. */
  motion: 'none' | 'subtle' | 'standard';
  /** Enables the lightweight Bloomora petal reveal on this template only. */
  flowerTransition?: boolean;
}

export type ArtStyle =
  | 'editorial-luxury' | 'botanical-floral' | 'vintage-romantic' | 'modern-minimal'
  | 'scrapbook-memories' | 'cinematic-storytelling' | 'japanese-inspired'
  | 'contemporary-wedding' | 'playful-celebration' | 'classic-traditional';
export type HeroComposition =
  | 'centered-cover' | 'split-photo' | 'offset-editorial' | 'type-poster'
  | 'framed-invitation' | 'quiet-left' | 'fullbleed-photo' | 'vertical-calm';
export type GalleryComposition =
  | 'masonry' | 'filmstrip' | 'polaroid' | 'contact-sheet' | 'collage' | 'single-feature' | 'staggered';
export type MotionCharacter =
  | 'fade' | 'paper-open' | 'editorial' | 'cinematic' | 'drift' | 'petal' | 'spring' | 'slow-reveal' | 'still';
export interface ArtDirection {
  style: ArtStyle;
  hero: HeroComposition;
  gallery: GalleryComposition;
  motion: MotionCharacter;
}

export type FieldKind = 'text' | 'textarea' | 'date' | 'pin';
export interface FieldDef {
  key: string;
  kind: FieldKind;
  label: L10n;
  hint?: L10n;
  maxLength: number;
  required?: boolean;
}
export interface ListDef {
  key: string;
  label: L10n;
  itemLabel: L10n;
  itemFields: FieldDef[];
  /** Hidden engine-owned metadata accepted on list items but never rendered as an editable field. */
  systemFields?: Record<string, number>;
  minItems: number;
  maxItems: number;
}

/**
 * Variants each section type supports. The renderer must implement every
 * variant listed here; config validation rejects anything else.
 */
export const SECTION_VARIANTS: Record<SectionType, readonly string[]> = {
  opening: ['sealed-letter', 'curtain', 'cover-page'],
  hero: ['editorial-title', 'centered-quiet', 'split-columns'],
  letter: ['folio', 'handwritten-card', 'typewritten'],
  gallery: ['plates', 'contact-sheet', 'filmstrip'],
  timeline: ['vertical-chapters', 'dated-ledger', 'horizontal-track'],
  message: ['reasons-deck', 'tap-to-reveal', 'pull-quotes'],
  appreciation: ['quiet-note', 'index-card'],
  music: ['quiet-player'],
  closing: ['signature', 'full-stop', 'postscript'],
};

export interface SectionDef {
  id: string;
  type: SectionType;
  variant: string;
  /** Optional sections can be switched off by the owner. Others always render. */
  optional?: boolean;
  /** Section is only rendered when the gift actually has this media. */
  requiresMedia?: 'audio';
  fields: FieldDef[];
  lists: ListDef[];
}

export interface SampleContent {
  fields: Record<string, string>;
  lists: Record<string, Record<string, string>[]>;
}

export interface TemplateConfig {
  id: string;
  /** Bump on any change that alters field keys or layout. Published gifts pin the version they used. */
  version: number;
  name: L10n;
  tagline: L10n;
  description: L10n;
  category: CategoryId;
  tier: TemplateTier;
  /** Inactive templates disappear from the catalog but keep rendering existing gifts. */
  status: 'active' | 'inactive';
  featured: boolean;
  popular: boolean;
  isNew: boolean;
  /** True only when a real interactive demo is built for this template. */
  hasDemo: boolean;
  theme: Theme;
  /** Visual composition tokens; optional on legacy pinned templates. */
  artDirection?: ArtDirection;
  sections: SectionDef[];
  /** Complete sample content, used by the demo, catalog preview and as the editor's starter. */
  sample: Record<Locale, SampleContent>;
}

/* ---------------- Render model ---------------- */

export interface RenderSection {
  id: string;
  type: SectionType;
  variant: string;
  fields: Record<string, string>;
  lists: Record<string, Record<string, string>[]>;
}

export interface RenderModel {
  templateId: string;
  templateVersion: number;
  theme: Theme;
  artDirection?: ArtDirection;
  sections: RenderSection[];
  hasAudio: boolean;
}

export type { GiftContent };
