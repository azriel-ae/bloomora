import type { Metadata } from 'next';
import { TemplatesPageView } from '@/components/templates-page';
import { getLocale } from '@/lib/i18n';
export async function generateMetadata(): Promise<Metadata> { const locale = await getLocale(); return { title: locale === 'id' ? 'Template hadiah' : 'Gift templates', description: locale === 'id' ? 'Mulai hadiah Bloomora dari template original yang sesuai dengan rasa yang ingin kamu bagikan.' : 'Start your Bloomora gift with an original template for the feeling you want to share.', alternates: { languages: { id: '/id/templates', en: '/en/templates' } } }; }
export default function TemplatesPage() { return <TemplatesPageView />; }
