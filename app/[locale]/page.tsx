import type { Metadata } from 'next';
import { HomePage } from '@/components/home-page';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Bloomora — Hadiah digital penuh cerita',
    description: 'Buat hadiah digital yang personal dan indah untuk orang tersayang, tanpa perlu menulis kode.',
    alternates: { canonical: '/' },
  };
}

export default function Page() { return <HomePage />; }
