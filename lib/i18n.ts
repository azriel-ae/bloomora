import { cookies } from 'next/headers';
import { defaultLocale, isLocale, localeCookie, getMessages, messages, locales, formatRupiah } from './i18n-core';
export { defaultLocale, isLocale, localeCookie, getMessages, messages, locales, formatRupiah };
export type { Locale } from './i18n-core';
export async function getLocale() { const value = (await cookies()).get(localeCookie)?.value; return isLocale(value) ? value : defaultLocale; }
