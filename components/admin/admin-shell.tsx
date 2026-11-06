'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, CreditCard, LayoutDashboard, LogOut, Menu, Package, ReceiptText, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders / Transaksi', icon: ReceiptText },
  { href: '/admin/packages', label: 'Packages', icon: Package },
  { href: '/admin/payment-methods', label: 'Payment methods', icon: CreditCard },
  { href: '/admin/vouchers', label: 'Vouchers', icon: BarChart3 },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  // Strip an internal /{locale} prefix so server and client agree on the route.
  const pathname = (usePathname() ?? '').replace(/^\/(?:id|en)(?=\/|$)/, '') || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isLogin = pathname === '/admin/login';

  async function logout() {
    if (!window.confirm('Log out of the Bloomora admin dashboard?')) return;
    setLoggingOut(true);
    try {
      const client = createSupabaseBrowserClient();
      if (client) await client.auth.signOut();
      await fetch('/api/auth/session', { method: 'DELETE' });
    } finally {
      router.replace('/admin/login');
    }
  }

  if (isLogin) return <>{children}</>;
  return <div className="min-h-screen bg-ivory">
    <div className={`fixed inset-0 z-40 bg-ink/25 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setOpen(false)} aria-hidden="true" />
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-paper px-5 py-6 shadow-soft transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}><span className="grid size-10 place-items-center rounded-2xl bg-moss text-lg font-bold text-ivory">B</span><span><span className="block font-display text-2xl leading-none">Bloomora</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.18em] text-ink/45">Admin workspace</span></span></Link>
        <button className="rounded-xl p-2 text-ink/50 hover:bg-ivory lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button>
      </div>
      <nav className="mt-10 space-y-1" aria-label="Admin navigation">{navItems.map((item) => { const Icon = item.icon; const active = isActive(pathname, item); return <Link key={item.href} href={item.href} prefetch={false} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${active ? 'bg-sage/25 text-moss' : 'text-ink/60 hover:bg-ivory hover:text-ink'}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} />{item.label}</Link>; })}</nav>
      <div className="mt-auto border-t border-line pt-5"><div className="mb-3 flex items-center gap-3 rounded-2xl bg-ivory px-3 py-3"><span className="grid size-9 place-items-center rounded-full bg-sage/35 text-sm font-bold text-moss">{(email?.[0] ?? 'A').toUpperCase()}</span><div className="min-w-0"><p className="text-xs font-bold text-ink/45">Signed in as</p><p className="truncate text-sm font-semibold">{email ?? 'Bloomora admin'}</p></div></div><button onClick={() => void logout()} disabled={loggingOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-ink/60 hover:bg-[#f2dfd8] hover:text-ink disabled:opacity-50"><LogOut size={18} />{loggingOut ? 'Logging out…' : 'Log out'}</button></div>
    </aside>
    <div className="lg:pl-72"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-line/80 bg-ivory/90 px-5 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-xl border border-line bg-paper p-2.5 lg:hidden" aria-label="Open navigation"><Menu size={19} /></button><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-moss">Bloomora administration</p><p className="mt-1 text-sm font-semibold text-ink/65">{navItems.find((item) => isActive(pathname, item))?.label ?? 'Admin workspace'}</p></div></div><div className="hidden items-center gap-3 text-right sm:flex"><ShieldCheck size={18} className="text-moss" /><div><p className="text-xs font-bold">Authorized workspace</p><p className="text-xs text-ink/45">{email ?? 'Admin account'}</p></div></div></header><main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main></div>
  </div>;
}
