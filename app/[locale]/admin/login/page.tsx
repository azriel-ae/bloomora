import type { Metadata } from 'next';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { AuthForm } from '@/components/auth-forms';

export const metadata: Metadata = { title: 'Admin login', description: 'Restricted Bloomora owner administration login.', robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <div className="min-h-[calc(100vh-2rem)] py-6 sm:py-10"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-paper shadow-soft lg:grid-cols-[.85fr_1.15fr]">
    <div className="paper-grid flex flex-col justify-between bg-sage/15 p-7 sm:p-10 lg:p-12"><div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-moss text-xl font-bold text-ivory">B</span><span className="font-display text-2xl">Bloomora</span></div><p className="mt-16 text-xs font-bold uppercase tracking-[.18em] text-moss">Private workspace</p><h1 className="mt-4 max-w-sm font-display text-4xl leading-tight sm:text-5xl">Make every detail feel considered.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-ink/60">Manage orders, packages, payment instructions, and vouchers from one calm, focused dashboard.</p></div><div className="mt-12 flex items-center gap-3 text-xs font-semibold text-ink/55"><ShieldCheck size={17} className="text-moss" /> Restricted to provisioned Bloomora administrators</div></div>
    <div className="p-7 sm:p-10 lg:p-14"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-moss"><Sparkles size={15} /> Welcome back</div><h2 className="mt-4 font-display text-4xl">Admin login</h2><p className="mt-3 max-w-md text-sm leading-6 text-ink/60">Sign in to continue to the Bloomora administration workspace. Customers do not need an account.</p><AuthForm mode="login" redirectTo="/admin" /></div>
  </div></div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
