import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Chatbot } from '@/components/chatbot';
import { LocaleProvider } from '@/components/locale-provider';
import { ChromeGate } from '@/components/chrome-gate';
import { AdminChromeGate } from '@/components/admin-chrome-gate';
import { locales, resolveLocale } from '@/lib/i18n-core';

export const metadata: Metadata = {
  title: { default: 'Bloomora — Digital gifts with a little more feeling', template: '%s · Bloomora' },
  description: 'Create a small, beautiful world for someone you love — no code required.',
  keywords: ['digital gifts', 'online greeting card', 'personalized gift', 'memory scrapbook'],
  icons: { icon: '/favicon.svg' },
};

/**
 * The locale comes from the route segment (the middleware rewrites every page request to
 * /{locale}/...), not from cookies(). Reading cookies here would make every page render
 * on the server per visitor; with the param, informational pages are prerendered per locale.
 */
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const locale = resolveLocale((await params).locale);
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <AdminChromeGate><ChromeGate><SiteHeader /></ChromeGate></AdminChromeGate>
          <main>{children}</main>
          <AdminChromeGate><ChromeGate><Chatbot /></ChromeGate></AdminChromeGate>
          <AdminChromeGate><ChromeGate><SiteFooter /></ChromeGate></AdminChromeGate>
        </LocaleProvider>
      </body>
    </html>
  );
}
