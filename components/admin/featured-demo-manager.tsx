'use client';

import { useMemo, useState } from 'react';
import { GiftView } from '@/components/gift/gift-view';
import { getActiveTemplate, listCatalog } from '@/lib/engine/registry';
import { sampleContent } from '@/lib/engine/resolve';
import { useLocale } from '@/components/locale-provider';

export function FeaturedDemoManager({ initialTemplateId }: { initialTemplateId: string }) {
  const { locale } = useLocale();
  const templates = useMemo(() => listCatalog(), []);
  const [selected, setSelected] = useState(initialTemplateId);
  const [saved, setSaved] = useState(initialTemplateId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const template = getActiveTemplate(selected);

  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/featured-demo', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (data.code === 'featured_demo_schema_missing') throw new Error('Tabel pengaturan belum tersedia. Jalankan migration supabase/migrations/20261108000100_featured_demo_setting.sql di Supabase SQL Editor, lalu coba lagi.');
        if (data.code === 'featured_demo_access_denied') throw new Error('Database menolak akses simpan. Periksa koneksi server dan grant migration.');
        throw new Error(data.code ?? 'gagal_menyimpan');
      }
      setSaved(selected); setMessage(`Tersimpan. Demo publik sekarang menggunakan ${template?.name.id ?? selected}.`);
    } catch (error) {
      setMessage(`Belum tersimpan: ${error instanceof Error ? error.message : 'kesalahan jaringan'}`);
    } finally { setBusy(false); }
  }

  return <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(17rem,.65fr)_1.35fr]">
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <label htmlFor="featured-template" className="text-sm font-bold">Pilih template halaman Demo publik</label>
      <select id="featured-template" value={selected} onChange={(e) => { setSelected(e.target.value); setMessage(''); }} className="mt-3 w-full rounded-xl border border-line bg-ivory px-3 py-3 text-sm">
        {templates.map((item) => <option key={item.id} value={item.id}>{item.name.id}</option>)}
      </select>
      <p className="mt-3 text-sm leading-6 text-ink/60">Pratinjau memakai renderer dan interaksi asli template. Mengganti daftar hanya memperbarui pratinjau; tekan tombol simpan di bawah agar pilihan menjadi Demo publik.</p>
      <p className="mt-4 rounded-2xl bg-ivory p-4 text-sm"><span className="font-semibold">Demo publik saat ini:</span> {templates.find((item) => item.id === saved)?.name.id ?? 'Default Bloomora'}<br /><span className="mt-1 block font-mono text-xs text-ink/50">/demo/{saved}</span></p>
      <button type="button" disabled={busy || selected === saved} onClick={() => void save()} className="mt-5 rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan pilihan sebagai Demo utama'}</button>
      {message && <p role="status" className="mt-3 text-sm text-moss">{message}</p>}
    </div>
    <div className="min-w-0 rounded-3xl border border-line bg-ivory p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2 px-2"><div><p className="text-xs font-bold uppercase tracking-widest text-moss">Pratinjau</p><p className="mt-1 font-display text-2xl">{template?.name.id}</p></div><span className="rounded-full bg-paper px-3 py-1 text-xs">Mobile + desktop</span></div>
      {template && <div key={template.id} className="max-h-[70vh] min-h-[34rem] overflow-auto rounded-2xl border border-line bg-paper"><GiftView key={template.id} templateId={template.id} templateVersion={template.version} content={sampleContent(template, locale)} locale={locale} mode="demo" /></div>}
    </div>
  </section>;
}
