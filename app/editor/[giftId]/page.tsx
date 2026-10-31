import type { Metadata } from 'next';
import { GiftEditor } from '@/components/gift-editor';
import { getCurrentUser } from '@/lib/session';
import { AuthCallout } from '@/components/auth-callout';
export const metadata: Metadata = { title: 'Gift editor', description: 'Shape a Bloomora gift with a live preview.' };
export default async function EditorPage({ params }: { params: Promise<{ giftId: string }> }) { const { giftId } = await params; if (giftId !== 'demo' && !(await getCurrentUser())) return <div className="mx-auto max-w-3xl px-5 py-20 lg:px-8 lg:py-28"><AuthCallout title="Sign in to edit a private gift." /></div>; return <GiftEditor templateSlug={giftId === 'demo' ? 'pressed-garden' : giftId} />; }
