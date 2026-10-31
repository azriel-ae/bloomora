import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Chatbot } from '@/components/chatbot';
import { LocaleProvider } from '@/components/locale-provider';
import { ChromeGate } from '@/components/chrome-gate';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: { default: 'Bloomora — Digital gifts with a little more feeling', template: '%s · Bloomora' },
  description: 'Create a small, beautiful world for someone you love — no code required.',
  keywords: ['digital gifts', 'online greeting card', 'personalized gift', 'memory scrapbook'],
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <ChromeGate><SiteHeader /></ChromeGate>
          <main>{children}</main>
          <ChromeGate><Chatbot /></ChromeGate>
          <ChromeGate><SiteFooter /></ChromeGate>
        </LocaleProvider>
      </body>
    </html>
  );
}
