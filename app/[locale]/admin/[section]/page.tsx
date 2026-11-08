import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getCurrentUser } from '@/lib/session';
import { getMessages } from '@/lib/i18n';
import { AuthCallout } from '@/components/auth-callout';

const sections: Record<string, { title: string; body: string; fields: string[] }> = {
  orders: {
    title: 'Verifikasi pembayaran',
    body: 'Tinjau bukti QRIS, cocokkan status pesanan dan paket, lalu catat hasil verifikasi yang berwenang.',
    fields: ['Antrean bukti tertunda', 'Detail pesanan dan snapshot paket', 'Setujui atau tolak dengan alasan', 'Riwayat audit'],
  },
  qris: {
    title: 'Kelola QRIS',
    body: 'Unggah atau ganti gambar QRIS aktif dan instruksi pembayaran yang ditampilkan saat pembayaran.',
    fields: ['Gambar QRIS aktif', 'Konten instruksi pembayaran', 'Riwayat penggantian', 'Pemeriksaan kepemilikan penyimpanan'],
  },
  packages: {
    title: 'Konfigurasi paket',
    body: 'Kelola harga, durasi, batas media dan adegan, serta status aktif atau nonaktif yang dikendalikan server.',
    fields: ['Basic / Plus / Premium', 'Harga dalam rupiah bulat', 'Masa aktif dan batas', 'Akses template dan musik'],
  },
  settings: {
    title: 'Pengaturan situs',
    body: 'Ubah identitas merek, konten halaman utama, detail dukungan, teks hukum sementara, kategori, dan ketersediaan template.',
    fields: ['Detail merek dan kontak', 'Bagian halaman utama', 'Kategori dan template', 'Teks retensi dan dukungan'],
  },
};

export const metadata: Metadata = { title: 'Bagian Admin', description: 'Bagian terlindungi untuk administrasi Bloomora.' };

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const messages = getMessages('id');
  const data = sections[section];
  const title = data?.title ?? messages.adminSection.notConfigured;
  const description = data?.body ?? messages.adminSection.notConfigured;
  const fields = data?.fields ?? [];
  const user = await getCurrentUser();
  const isAdmin = Boolean(user && (user as { admin?: boolean }).admin);

  return <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-ink/55"><ArrowLeft size={15} /> {messages.adminSection.back}</Link>
    <div className="mt-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.adminSection.protected}</p><h1 className="mt-3 font-display text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60">{description}</p></div>
    {!isAdmin ? <div className="mt-10"><AuthCallout title={messages.adminSection.gated} /></div> : <div className="mt-10 rounded-3xl border border-line bg-paper p-7"><div className="flex items-center gap-3"><ShieldCheck className="text-moss" /><p className="font-semibold">{messages.adminSection.verified}</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{fields.map((field) => <div key={field} className="rounded-2xl bg-ivory px-4 py-3 text-sm">{field}</div>)}</div></div>}
  </div>;
}

// Reads per-request data (cookies, DB, search params, or secrets): never prerender or cache.
export const dynamic = 'force-dynamic';
