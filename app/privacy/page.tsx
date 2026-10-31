import type { Metadata } from 'next';
import { LocalizedInfoPage } from '@/components/localized-info-page';
export const metadata: Metadata = { title: 'Privacy', description: 'Bloomora information and policy.' };
export default function Page() { return <LocalizedInfoPage page="privacy" />; }
