import type { Metadata } from 'next';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { AuthForm } from '@/components/auth-forms';

export const metadata: Metadata = { title: 'Masuk Admin', description: 'Halaman masuk admin Bloomora yang dibatasi.', robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <div className="min-h-[calc(100vh-2rem)] py-6 sm:py-10"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-paper shadow-soft lg:grid-cols-[.85fr_1.15fr]">
    <div className="paper-grid flex flex-col justify-between bg-sage/15 p-7 sm:p-10 lg:p-12"><div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-moss text-xl font-bold text-ivory">B</span><span className="font-display text-2xl">Bloomora</span></div><p className="mt-16 text-xs font-bold uppercase tracking-[.18em] text-moss">Ruang kerja privat</p><h1 className="mt-4 max-w-sm font-display text-4xl leading-tight sm:text-5xl">Hadirkan perhatian dalam setiap detail.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-ink/60">Kelola pesanan, paket, instruksi pembayaran, dan voucher dari satu dasbor yang tenang dan terfokus.</p></div><div className="mt-12 flex items-center gap-3 text-xs font-semibold text-ink/55"><ShieldCheck size={17} className="text-moss" /> Khusus untuk administrator Bloomora yang telah diberi akses</div></div>
    <div className="p-7 sm:p-10 lg:p-14"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-moss"><Sparkles size={15} /> Selamat datang kembali</div><h2 className="mt-4 font-display text-4xl">Masuk Admin</h2><p className="mt-3 max-w-md text-sm leading-6 text-ink/60">Masuk untuk melanjutkan ke ruang kerja administrasi Bloomora. Pelanggan tidak memerlukan akun.</p><AuthForm mode="login" redirectTo="/admin" /></div>
  </div></div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
