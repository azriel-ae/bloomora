import id from '@/messages/id.json';
import en from '@/messages/en.json';

export const locales = ['id', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'id';
export const localeCookie = 'bloomora_locale';
export const messages = { id, en } as const;
export function isLocale(value: unknown): value is Locale { return value === 'id' || value === 'en'; }
/** Narrow a route param (or any string) to a supported locale, falling back to the default. */
export function resolveLocale(value: unknown): Locale { return isLocale(value) ? value : defaultLocale; }
export function getMessages(locale: Locale) { return messages[locale]; }
export function formatRupiah(amount: number, locale: Locale) { return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount); }
