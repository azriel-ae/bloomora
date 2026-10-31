'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Locale } from '@/lib/i18n-core';
import messages from '@/messages/id.json';
import english from '@/messages/en.json';

type Messages = typeof messages;
const catalogs: Record<Locale, Messages> = { id: messages, en: english };
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (section: keyof Messages, key: string) => string }>({ locale: 'id', setLocale: () => undefined, t: () => '' });
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) { const [locale, setLocaleState] = useState(initialLocale); const setLocale = (next: Locale) => { document.cookie = `bloomora_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`; setLocaleState(next); window.location.reload(); }; const t = useMemo(() => (section: keyof Messages, key: string) => String(catalogs[locale][section][key as never] ?? key), [locale]); return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>; }
export function useLocale() { return useContext(LocaleContext); }
