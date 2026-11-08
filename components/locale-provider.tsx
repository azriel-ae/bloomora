'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Locale } from '@/lib/i18n-core';
import messages from '@/messages/id.json';

type Messages = typeof messages;
const LocaleContext = createContext<{ locale: Locale; t: (section: keyof Messages, key: string) => string }>({ locale: 'id', t: () => '' });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const t = useMemo(() => (section: keyof Messages, key: string) => String(messages[section][key as never] ?? key), []);
  return <LocaleContext.Provider value={{ locale: 'id' as Locale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
