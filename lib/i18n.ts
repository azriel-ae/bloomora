import { defaultLocale, isLocale, resolveLocale, getMessages, messages, locales, formatRupiah } from './i18n-core';
export { defaultLocale, isLocale, resolveLocale, getMessages, messages, locales, formatRupiah };
export type { Locale } from './i18n-core';
export async function getLocale() { return defaultLocale; }
