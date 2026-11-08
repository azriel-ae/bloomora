import id from '@/messages/id.json';

// Locale bertipe lama tetap diterima oleh komponen data yang belum dimigrasi, tetapi
// satu-satunya locale yang dilayani aplikasi adalah Bahasa Indonesia.
export type Locale = 'id' | 'en';
export const locales = ['id'] as const;
export const defaultLocale: Locale = 'id';
export const messages = { id } as const;
export function isLocale(value: unknown): value is Locale { return value === 'id'; }
export function resolveLocale(value: unknown): Locale { return isLocale(value) ? 'id' : defaultLocale; }
export function getMessages(locale: Locale) { void locale; return messages.id; }
export function formatRupiah(amount: number, locale: Locale = 'id') {
  void locale;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}
