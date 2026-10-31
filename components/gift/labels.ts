import en from '@/messages/en.json';
import id from '@/messages/id.json';
import type { GiftLabels } from '@/lib/engine/labels';
import type { Locale } from '@/lib/engine/types';

/** Gift-experience interface text for a locale (keys are verified against GIFT_LABEL_KEYS in tests). */
export const giftLabels = (locale: Locale): GiftLabels => (locale === 'id' ? id.gift : en.gift) as GiftLabels;
