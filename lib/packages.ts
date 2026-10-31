import type { PackageDoc } from './model/types.ts';

/**
 * Seed and fallback package definitions. Values mirror the existing pricing
 * page (Basic Rp19.000 / 3 days, Plus Rp39.000 / 14 days, Premium Rp69.000 /
 * 30 days). The Firestore `packages` collection is authoritative once seeded;
 * these constants are only used to seed it and as a read fallback.
 */
export const DEFAULT_PACKAGES: readonly PackageDoc[] = [
  {
    id: 'basic', name: 'Basic', priceIdr: 19000, durationDays: 3, active: true, sortOrder: 1,
    limits: { maxGifts: 1, maxPhotos: 8, music: false, priorityReview: false, allowedTemplateTiers: ['core'] },
  },
  {
    id: 'plus', name: 'Plus', priceIdr: 39000, durationDays: 14, active: true, sortOrder: 2,
    limits: { maxGifts: 1, maxPhotos: 20, music: true, priorityReview: false, allowedTemplateTiers: ['core', 'extended'] },
  },
  {
    id: 'premium', name: 'Premium', priceIdr: 69000, durationDays: 30, active: true, sortOrder: 3,
    limits: { maxGifts: 1, maxPhotos: 40, music: true, priorityReview: true, allowedTemplateTiers: ['core', 'extended'] },
  },
];
