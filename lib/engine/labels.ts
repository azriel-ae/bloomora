/** Interface text used inside the gift experience. Values live in messages/{en,id}.json under "gift". */
export const GIFT_LABEL_KEYS = [
  'forLabel', 'fromLabel', 'openHint', 'openButton', 'chapterWord', 'navChapters', 'navMenuTitle', 'navClose',
  'backToStart', 'progress', 'sectionOpening', 'sectionHero', 'sectionLetter', 'sectionTimeline', 'sectionGallery',
  'sectionMessage', 'sectionAppreciation', 'sectionMusic', 'sectionClosing', 'openPlate', 'lightboxTitle',
  'lightboxPrev', 'lightboxNext', 'lightboxClose', 'lightboxCounter', 'reasonOpen', 'reasonClose', 'reasonLabel',
  'reasonsOpenNext', 'reasonsCloseAll', 'reasonsStatus', 'musicPlay', 'musicPause', 'musicLabel', 'closingReplay', 'emptyGift',
] as const;
export type GiftLabels = Record<(typeof GIFT_LABEL_KEYS)[number], string>;

/** "{n} of {total}" style interpolation. Unknown placeholders are left visible so mistakes show up in tests. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
