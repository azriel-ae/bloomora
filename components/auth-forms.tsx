'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { safeInternalRedirect } from '@/lib/safe-redirect';
import { siteUrl } from '@/lib/site-url';
import { useLocale } from './locale-provider';

function friendlyError(message: string | undefined, mode: 'login' | 'register') {
  if (message?.toLowerCase().includes('invalid login credentials')) return 'Email atau kata sandi tidak cocok.';
  if (message?.toLowerCase().includes('email not confirmed')) return 'Konfirmasikan email sebelum masuk.';
  if (message?.toLowerCase().includes('already registered')) return 'Akun dengan email tersebut sudah terdaftar.';
  if (mode === 'register') return 'Pendaftaran umum dinonaktifkan. Hanya admin Bloomora yang telah disiapkan yang dapat masuk.';
  return 'Proses masuk terganggu. Periksa kembali data Anda lalu coba lagi.';
}

export function AuthForm({ mode, redirectTo = '/dashboard' }: { mode: 'login' | 'register'; redirectTo?: string }) {
  const router = useRouter();
  const { t } = useLocale();
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
    if (mode === 'register') { setMessage('Pendaftaran umum dinonaktifkan. Hanya admin Bloomora yang telah disiapkan yang dapat masuk.'); return; }
    setPending(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const response = await fetch('/api/auth/session', { method: 'POST' });
      if (!response.ok) throw new Error('session_setup_failed');
      router.replace(safeInternalRedirect(redirectTo));
    } catch (error) {
      setMessage(friendlyError(error instanceof Error ? error.message : undefined, mode));
    } finally { setPending(false); }
  }

  async function resetPassword() {
    const client = createSupabaseBrowserClient();
    if (!client) { setMessage(t('auth', 'configMissing')); return; }
    if (!email) { setMessage('Masukkan email terlebih dahulu.'); return; }
    setPending(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: siteUrl('/login') });
      if (error) throw error;
      setMessage('Jika email terdaftar, tautan untuk mengatur ulang kata sandi akan segera dikirim.');
    } catch (error) { setMessage(friendlyError(error instanceof Error ? error.message : undefined, mode)); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-8 space-y-5">
    <label className="block text-sm font-semibold">{t('auth', 'email')}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-ivory px-4 py-3 outline-none transition focus:border-moss focus:ring-2 focus:ring-sage/30" placeholder="nama@email.com" /></label>
    <label className="block text-sm font-semibold">{t('auth', 'password')}<span className="relative mt-2 block"><input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-line bg-ivory px-4 py-3 pr-12 outline-none transition focus:border-moss focus:ring-2 focus:ring-sage/30" placeholder="Minimal 6 karakter" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/45 hover:bg-paper hover:text-ink" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
    {message && <p role="alert" className="rounded-2xl bg-[#f2dfd8] px-4 py-3 text-sm leading-6 text-ink/70">{message}</p>}
    <button type="submit" disabled={pending} aria-busy={pending} className="w-full rounded-2xl bg-moss px-5 py-3.5 text-sm font-semibold text-ivory shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft disabled:translate-y-0 disabled:opacity-50">{pending ? t('common', 'loading') : mode === 'login' ? t('auth', 'login') : t('auth', 'register')}</button>
    {mode === 'login' && <button type="button" disabled={pending} onClick={() => void resetPassword()} className="w-full text-center text-sm font-semibold text-moss">{t('auth', 'forgot')}</button>}
  </form>;
}
