import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-forms';
import { getLocale, getMessages } from '@/lib/i18n';
export async function generateMetadata(): Promise<Metadata> { const locale = await getLocale(); return { title: locale === 'id' ? 'Buat akun' : 'Create an account', description: locale === 'id' ? 'Buat ruang pribadi Bloomora untuk hadiahmu.' : 'Create a private Bloomora workspace for your gifts.' }; }
export default async function RegisterPage() { const locale = await getLocale(); const m = getMessages(locale); return <div className="mx-auto max-w-md px-5 py-20 lg:py-28"><div className="rounded-[2rem] border border-line bg-paper p-8 shadow-soft"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{m.authPage.eyebrow}</p><h1 className="mt-4 font-display text-4xl">{m.auth.registerTitle}</h1><p className="mt-3 text-sm leading-6 text-ink/60">{m.authPage.registerIntro}</p><AuthForm mode="register" /><p className="mt-6 text-sm text-ink/55">{m.authPage.already} <Link className="font-semibold text-moss" href="/login">{m.navigation.login}</Link></p></div></div>; }
