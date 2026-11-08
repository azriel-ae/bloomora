import { InfoPage } from './info-page';
import { getMessages } from '@/lib/i18n-core';
import type { Locale } from '@/lib/i18n-core';

export type LocalizedPageKey = 'about' | 'contact' | 'faq' | 'privacy' | 'terms' | 'refunds' | 'expiration' | 'media';
export function LocalizedInfoPage({ page, locale }: { page: LocalizedPageKey; locale: Locale }) { const content = getMessages(locale).pages[page]; return <InfoPage eyebrow={content.eyebrow} title={content.title} intro={content.intro} sections={content.sections} />; }
