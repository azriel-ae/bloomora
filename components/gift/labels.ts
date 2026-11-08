import id from '@/messages/id.json';
import type { GiftLabels } from '@/lib/engine/labels';
import type { Locale } from '@/lib/engine/types';

/** Label antarmuka pengalaman hadiah selalu menggunakan Bahasa Indonesia. */
export function giftLabels(locale: Locale): GiftLabels {
  void locale;
  return id.gift as GiftLabels;
}
