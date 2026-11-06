'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { safeInternalRedirect } from '@/lib/safe-redirect';
import { useLocale } from './locale-provider';

function friendlyError(message: string | undefined, mode: 'login' | 'register') {
  if (message?.toLowerCase().includes('invalid login credentials')) return 'That email or password did not match.';
  if (message?.toLowerCase().includes('email not confirmed')) return 'Confirm your email before signing in.';
  if (message?.toLowerCase().includes('already registered')) return 'An account already exists for that email.';
  if (mode === 'register') return 'Public registration is disabled. Only provisioned Bloomora administrators may sign in.';
  return 'Something interrupted the account flow. Please check your details and try again.';
}

export function AuthForm({ mode, redirectTo = '/dashboard' }: { mode: 'login' | 'register'; redirectTo?: string }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage('');
    const client = createSupabaseBrowserClient();
    if (!client) { setMessage(t('auth', 'configMissing')); return; }
    if (mode === 'register') { setMessage(locale === 'id' ? 'Pendaftaran publik dinonaktifkan. Hanya admin Bloomora yang sudah diprovisikan yang dapat masuk.' : 'Public registration is disabled. Only provisioned Bloomora administrators may sign in.'); return; }
    setPending(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const response = await fetch('/api/auth/session', { method: 'POST' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? 'Session setup failed.'); }
      router.replace(safeInternalRedirect(redirectTo));
    } catch (error) {
      setMessage(error instanceof Error && error.message.includes('Session setup') ? error.message : friendlyError(error instanceof Error ? error.message : undefined, mode));
    } finally { setPending(false); }
  }

  async function resetPassword() {
    const client = createSupabaseBrowserClient();
    if (!client) { setMessage(t('auth', 'configMissing')); return; }
    if (!email) { setMessage(locale === 'id' ? 'Masukkan email terlebih dahulu.' : 'Enter your email first.'); return; }
    setPending(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      setMessage(locale === 'id' ? 'Jika email terdaftar, tautan reset akan segera dikirim.' : 'If that email is registered, a reset link is on its way.');
    } catch (error) { setMessage(friendlyError(error instanceof Error ? error.message : undefined, mode)); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-8 space-y-5">
    <label className="block text-sm font-semibold">{t('auth', 'email')}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-ivory px-4 py-3 outline-none transition focus:border-moss focus:ring-2 focus:ring-sage/30" placeholder="you@example.com" /></label>
    <label className="block text-sm font-semibold">{t('auth', 'password')}<span className="relative mt-2 block"><input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-line bg-ivory px-4 py-3 pr-12 outline-none transition focus:border-moss focus:ring-2 focus:ring-sage/30" placeholder={locale === 'id' ? 'Minimal 6 karakter' : 'At least 6 characters'} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/45 hover:bg-paper hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
    {message && <p role="alert" className="rounded-2xl bg-[#f2dfd8] px-4 py-3 text-sm leading-6 text-ink/70">{message}</p>}
    <button type="submit" disabled={pending} aria-busy={pending} className="w-full rounded-2xl bg-moss px-5 py-3.5 text-sm font-semibold text-ivory shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft disabled:translate-y-0 disabled:opacity-50">{pending ? t('common', 'loading') : mode === 'login' ? t('auth', 'login') : t('auth', 'register')}</button>
    {mode === 'login' && <button type="button" disabled={pending} onClick={() => void resetPassword()} className="w-full text-center text-sm font-semibold text-moss">{t('auth', 'forgot')}</button>}
  </form>;
}
