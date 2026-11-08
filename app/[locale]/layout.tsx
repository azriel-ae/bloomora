import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Chatbot } from '@/components/chatbot';
import { LocaleProvider } from '@/components/locale-provider';
import { ChromeGate } from '@/components/chrome-gate';
import { AdminChromeGate } from '@/components/admin-chrome-gate';
import { locales } from '@/lib/i18n-core';
import { SITE_ORIGIN } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: 'Bloomora — Hadiah digital penuh cerita', template: '%s · Bloomora' },
  description: 'Buat hadiah digital yang personal dan indah untuk orang tersayang, tanpa perlu menulis kode.',
  keywords: ['hadiah digital', 'kartu ucapan online', 'hadiah personal', 'album kenangan'],
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Bloomora',
    url: SITE_ORIGIN,
    title: 'Bloomora — Hadiah digital penuh cerita',
    description: 'Buat hadiah digital yang personal dan indah untuk orang tersayang.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bloomora — Hadiah digital penuh cerita',
    description: 'Buat hadiah digital yang personal dan indah untuk orang tersayang.',
  },
};

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  return (
    <html lang="id">
      <body>
        <LocaleProvider>
          <AdminChromeGate><ChromeGate><SiteHeader /></ChromeGate></AdminChromeGate>
          <main>{children}</main>
          <AdminChromeGate><ChromeGate><Chatbot /></ChromeGate></AdminChromeGate>
          <AdminChromeGate><ChromeGate><SiteFooter /></ChromeGate></AdminChromeGate>
        </LocaleProvider>
      </body>
    </html>
  );
}
