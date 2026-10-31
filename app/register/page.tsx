import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-forms';
import { getLocale, getMessages } from '@/lib/i18n';
import { safeInternalRedirect } from '@/lib/safe-redirect';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: locale === 'id' ? 'Buat akun' : 'Create an account', description: locale === 'id' ? 'Buat ruang pribadi Bloomora untuk hadiahmu.' : 'Create a private Bloomora workspace for your gifts.' };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, locale] = await Promise.all([searchParams, getLocale()]);
  const messages = getMessages(locale);
  const redirectTo = safeInternalRedirect(next);
  return <div className="mx-auto max-w-md px-5 py-20 lg:py-28"><div className="rounded-[2rem] border border-line bg-paper p-8 shadow-soft"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.authPage.eyebrow}</p><h1 className="mt-4 font-display text-4xl">{messages.auth.registerTitle}</h1><p className="mt-3 text-sm leading-6 text-ink/60">{messages.authPage.registerIntro}</p><AuthForm mode="register" redirectTo={redirectTo} /><p className="mt-6 text-sm text-ink/55">{messages.authPage.already} <Link className="font-semibold text-moss" href={`/login?next=${encodeURIComponent(redirectTo)}`}>{messages.navigation.login}</Link></p></div></div>;
}
