import type { ArtDirection, ArtStyle, GalleryComposition, HeroComposition, MotionCharacter, TemplateConfig } from './types.ts';

const art = (style: ArtStyle, hero: HeroComposition, gallery: GalleryComposition, motion: MotionCharacter): ArtDirection => ({ style, hero, gallery, motion });

/**
 * Deliberate, per-template visual direction. New catalog versions consume these
 * tokens in the shared GiftView/GiftExperience renderer; old pinned versions
 * remain available without an artDirection and keep their original appearance.
 */
export const TEMPLATE_ART_DIRECTIONS: Record<string, ArtDirection> = {
  'interactive-flower-adventure': art('botanical-floral', 'centered-cover', 'polaroid', 'petal'),
  'chapter-of-us': art('editorial-luxury', 'offset-editorial', 'collage', 'editorial'),
  'pressed-garden': art('botanical-floral', 'vertical-calm', 'masonry', 'petal'),
  'our-little-archive': art('scrapbook-memories', 'framed-invitation', 'polaroid', 'spring'),
  'just-a-letter': art('vintage-romantic', 'quiet-left', 'single-feature', 'paper-open'),
  'love-letter-after-rain': art('vintage-romantic', 'centered-cover', 'filmstrip', 'drift'),
  'wedding-garden-vows': art('botanical-floral', 'framed-invitation', 'staggered', 'petal'),
  'birthday-paper-confetti': art('playful-celebration', 'type-poster', 'collage', 'spring'),
  'apology-room-to-listen': art('modern-minimal', 'quiet-left', 'single-feature', 'fade'),
  'family-table-stories': art('vintage-romantic', 'split-photo', 'polaroid', 'paper-open'),
  'graduation-next-page': art('editorial-luxury', 'split-photo', 'contact-sheet', 'cinematic'),
  'new-chapter-announcement': art('botanical-floral', 'centered-cover', 'single-feature', 'petal'),
  'ramadan-lantern-letter': art('classic-traditional', 'framed-invitation', 'contact-sheet', 'slow-reveal'),
  'anniversary-seasons-kept': art('cinematic-storytelling', 'fullbleed-photo', 'filmstrip', 'cinematic'),
  'valentines-postmark': art('vintage-romantic', 'type-poster', 'single-feature', 'paper-open'),
  'apology-staying-present': art('modern-minimal', 'split-photo', 'collage', 'fade'),
  'wedding-quiet-ivory': art('contemporary-wedding', 'quiet-left', 'single-feature', 'still'),
  'wedding-aksara-evening': art('classic-traditional', 'framed-invitation', 'filmstrip', 'slow-reveal'),
  'birthday-midnight-table': art('playful-celebration', 'fullbleed-photo', 'collage', 'spring'),
  'friendship-city-atlas': art('scrapbook-memories', 'split-photo', 'contact-sheet', 'spring'),
  'eid-homeward-table': art('classic-traditional', 'centered-cover', 'polaroid', 'slow-reveal'),
  'wedding-blossom-parchment': art('botanical-floral', 'type-poster', 'masonry', 'petal'),
  'wedding-gold-editorial': art('editorial-luxury', 'offset-editorial', 'single-feature', 'drift'),
  'wedding-intimate-afterglow': art('contemporary-wedding', 'centered-cover', 'filmstrip', 'paper-open'),
  'engagement-first-to-forever': art('contemporary-wedding', 'split-photo', 'polaroid', 'petal'),
  'bridal-shower-gathering': art('playful-celebration', 'framed-invitation', 'staggered', 'spring'),
  'letter-for-mother': art('japanese-inspired', 'vertical-calm', 'single-feature', 'drift'),
  'graduation-work-in-the-margins': art('editorial-luxury', 'quiet-left', 'contact-sheet', 'fade'),
  'christmas-window-light': art('vintage-romantic', 'centered-cover', 'collage', 'paper-open'),
  'apology-friendship-repair': art('scrapbook-memories', 'type-poster', 'polaroid', 'spring'),
  'birthday-mothers-sunday': art('botanical-floral', 'split-photo', 'masonry', 'petal'),
  'farewell-last-train': art('cinematic-storytelling', 'fullbleed-photo', 'staggered', 'cinematic'),
  'moving-away-photo-route': art('scrapbook-memories', 'split-photo', 'collage', 'drift'),
  'baby-gender-reveal-garden': art('playful-celebration', 'centered-cover', 'staggered', 'spring'),
  'fathers-day-built-together': art('modern-minimal', 'offset-editorial', 'contact-sheet', 'fade'),
  'new-year-room-to-begin': art('japanese-inspired', 'vertical-calm', 'filmstrip', 'still'),
  'anniversary-miles-and-mornings': art('cinematic-storytelling', 'split-photo', 'contact-sheet', 'cinematic'),
  'wedding-coastal-letters': art('contemporary-wedding', 'fullbleed-photo', 'staggered', 'drift'),
  'wedding-city-hall-promise': art('modern-minimal', 'quiet-left', 'contact-sheet', 'fade'),
  'anniversary-distance-letters': art('japanese-inspired', 'split-photo', 'filmstrip', 'drift'),
  'birthday-first-light': art('playful-celebration', 'centered-cover', 'polaroid', 'spring'),
  'apology-sibling-open-door': art('modern-minimal', 'framed-invitation', 'single-feature', 'paper-open'),
  'graduation-first-in-family': art('classic-traditional', 'split-photo', 'polaroid', 'slow-reveal'),
  'friendship-voice-note-archive': art('scrapbook-memories', 'fullbleed-photo', 'contact-sheet', 'spring'),
  'lunar-new-year-open-table': art('classic-traditional', 'centered-cover', 'collage', 'petal'),
  'for-you-scrapbook': art('scrapbook-memories', 'framed-invitation', 'polaroid', 'paper-open'),
};

export function designedTemplate(config: TemplateConfig): TemplateConfig {
  const direction = TEMPLATE_ART_DIRECTIONS[config.id];
  if (!direction) throw new Error(`Missing art direction for template: ${config.id}`);
  return { ...config, version: config.version + 1, artDirection: direction };
}
