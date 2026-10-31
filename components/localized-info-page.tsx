import { InfoPage } from './info-page';
import { getLocale, getMessages } from '@/lib/i18n';

export type LocalizedPageKey = 'about' | 'contact' | 'faq' | 'privacy' | 'terms' | 'refunds' | 'expiration' | 'media';
export async function LocalizedInfoPage({ page }: { page: LocalizedPageKey }) { const locale = await getLocale(); const content = getMessages(locale).pages[page]; return <InfoPage eyebrow={content.eyebrow} title={content.title} intro={content.intro} sections={content.sections} />; }
