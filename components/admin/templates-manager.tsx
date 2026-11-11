'use client';

import { useEffect, useState } from 'react';
import { Archive, Check, Eye, FileArchive, LoaderCircle, Maximize2, Minimize2, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';

type TemplateAnalysis = {
  format: 'html' | 'react' | 'unsupported';
  renderer: string;
  entryPoint: string | null;
  language: string;
  files: { path: string; kind: string; size: number }[];
  dependencies: { local: string[]; external: string[]; missing: string[] };
  features: string[];
  editableFields: { key: string; label: string; type: string }[];
  errors: string[];
  warnings: string[];
};
type TemplateRow = { id: string; slug: string; name: string; description: string; category: string; renderer: string; status: string; version: number; entry_point: string | null; manifest: Record<string, unknown>; validation_errors: string[] };
type Usage = { gifts: number; activeGifts: number; drafts: number; publicGifts: number; publishedRevisions: number; files: number; total: number; canDeletePermanently: boolean };
const statusLabel: Record<string, string> = { draft: 'Draft', processing: 'Sedang diproses', validation_failed: 'Validasi gagal', ready_for_preview: 'Siap dipreview', published: 'Dipublikasikan', archived: 'Diarsipkan' };
const pipelineLabels: Record<string, string> = { uploaded: 'File diterima', extracting: 'Ekstraksi ZIP', analyzing: 'Analisis file dan dependensi', manifest_generation: 'Pembuatan manifest', validating: 'Validasi', compatibility_check: 'Cek kompatibilitas', preview_ready: 'Preview siap' };
const errorCopy: Record<string, string> = {
  admin_required: 'Akses admin diperlukan.', dynamic_template_migration_required: 'Tabel template belum tersedia. Di Supabase SQL Editor, jalankan berurutan migration 20261110000100_dynamic_templates.sql, 20261110000200_dynamic_template_lifecycle.sql, dan 20261111000100_dynamic_template_asset_mime.sql, lalu coba lagi.', dynamic_template_migration_outdated: 'Skema dynamic_templates belum sesuai. Pastikan migration dynamic-template sudah diterapkan di Supabase.', duplicate_slug: 'Slug template sudah digunakan. Ubah slug pada manifest lalu coba lagi.', admin_user_reference_invalid: 'Akun admin tidak cocok dengan pengguna Supabase. Muat ulang sesi admin atau periksa auth.users.', dynamic_template_metadata_invalid: 'Metadata ditolak oleh aturan tabel. Periksa nama, slug, kategori, renderer, versi, dan migration yang terpasang.', dynamic_template_database_permission: 'service_role belum memiliki akses ke tabel dynamic_templates. Jalankan migration 20261111000200_dynamic_template_service_role_grants.sql di Supabase SQL Editor, lalu coba lagi.', dynamic_template_service_role_key_invalid: 'Kredensial service_role Supabase pada deployment ditolak. Pastikan SUPABASE_SERVICE_ROLE_KEY berisi secret service_role yang benar.', dynamic_template_database_error: 'Database gagal menyimpan metadata. Kode penyebab sudah tersedia pada respons/log server.', draft_delete_only: 'Template yang sudah dipublikasikan atau diarsipkan tidak dapat dihapus; gunakan Arsipkan.', storage_list_failed: 'File draft gagal diperiksa. Tidak ada data yang dihapus; coba lagi.', upload_required: 'Pilih satu file HTML atau ZIP terlebih dahulu.', upload_must_be_html_or_zip: 'Pilih satu file .html atau .zip.', html_entry_point_missing: 'ZIP tidak berisi file HTML sebagai entry point.', react_build_worker_unavailable: 'Paket React/TSX belum dapat diproses. Unggah hasil build HTML statis atau HTML dan asetnya.', unbundled_package_dependencies: 'HTML mengimpor package npm yang belum dibundle. Unggah hasil build statis beserta aset lokalnya.', unsupported_template_format: 'Format file ini belum didukung.', manifest_invalid_json: 'Manifest harus berupa JSON yang valid.', renderer_detection_mismatch: 'Renderer tidak dapat diubah dari hasil deteksi sistem.', unsupported_feature_claim: 'Hapus fitur yang tidak ditemukan oleh analisis otomatis.', unsupported_locale_claim: 'Hapus locale yang belum terdeteksi pada template.', unsupported_editor_field_claim: 'Hapus field editor yang tidak ditemukan di HTML.', local_assets_missing: 'Ada aset lokal yang belum disertakan.', external_resources_unverified: 'URL atau package dependency belum diverifikasi dan diblokir saat preview.',
};
const statusMessage = (code: string, message?: string) => errorCopy[code] ?? message ?? 'Proses gagal. Periksa format file dan coba lagi.';

export function TemplatesManager() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<TemplateAnalysis | null>(null);
  const [manifestText, setManifestText] = useState('');
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewFullScreen, setPreviewFullScreen] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/admin/templates', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok) setTemplates(data.templates ?? []);
      else setMessage(statusMessage(data.code, data.message));
    } catch { setMessage('Tidak dapat memuat template dari server. Periksa koneksi dan konfigurasi Supabase.'); }
  }
  useEffect(() => { void load(); }, []);

  function resetAnalysis() { setAnalysis(null); setManifestText(''); setPipeline([]); setMessage(''); }
  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!upload) { setMessage('Pilih satu file HTML atau ZIP terlebih dahulu.'); return; }
    setBusy(true); setMessage(''); setPipeline(['uploaded', 'analyzing']);
    const form = new FormData(); form.set('upload', upload); form.set('analyzeOnly', 'true');
    try {
      const response = await fetch('/api/admin/templates', { method: 'POST', body: form });
      const data = await response.json();
      if (data.analysis) setAnalysis(data.analysis);
      if (data.manifest) setManifestText(JSON.stringify(data.manifest, null, 2));
      if (data.pipeline) setPipeline(data.pipeline);
      if (!response.ok) setMessage(statusMessage(data.code, data.message));
      else setMessage(data.analysis?.errors?.length ? 'Analisis selesai, tetapi format belum dapat diproses.' : 'Analisis selesai. Tinjau manifest dan peringatan sebelum menyimpan draft.');
    } catch { setMessage('Tidak dapat menghubungi server untuk menganalisis file.'); }
    finally { setBusy(false); }
  }

  async function saveDraft() {
    if (!upload || !analysis || analysis.errors.length) return;
    setBusy(true); setMessage(''); setPipeline(['uploaded', ...(upload.name.toLowerCase().endsWith('.zip') ? ['extracting'] : []), 'analyzing', 'manifest_generation', 'validating']);
    const form = new FormData(); form.set('upload', upload); form.set('manifestJson', manifestText);
    try {
      const response = await fetch('/api/admin/templates', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) { setMessage(statusMessage(data.code, data.message)); return; }
      setPipeline(data.pipeline ?? ['preview_ready']);
      setMessage('Draft tersimpan. Preview tersedia untuk pemeriksaan admin; belum dapat dipublikasikan ke katalog customer.');
      setUpload(null); setAnalysis(null); setManifestText('');
      const input = document.getElementById('template-upload') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch { setMessage('Tidak dapat menyimpan draft. Coba lagi setelah koneksi pulih.'); }
    finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true);
    const response = await fetch(`/api/admin/templates/${id}/publish`, { method: 'POST' });
    const data = await response.json();
    setMessage(response.ok ? 'Template dipublikasikan.' : statusMessage(data.code, data.message));
    setBusy(false); void load();
  }
  async function changeStatus(template: TemplateRow, action: 'archive' | 'restore') {
    const consequence = action === 'archive' ? 'Template akan hilang dari katalog dan tidak bisa dipilih untuk gift baru. Gift lama tetap dipertahankan.' : 'Template akan tersedia lagi untuk preview.';
    if (!window.confirm(`${action === 'archive' ? 'Arsipkan' : 'Pulihkan'} template “${template.name}”?\n\n${consequence}`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/templates/${template.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await response.json(); setMessage(response.ok ? `Template ${action === 'archive' ? 'diarsipkan' : 'dipulihkan'}.` : statusMessage(data.code, data.message));
    setBusy(false); void load();
  }
  async function remove(template: TemplateRow) {
    if (!['draft', 'ready_for_preview', 'validation_failed'].includes(template.status)) { setMessage('Hanya template Draft yang boleh dihapus. Template yang pernah dipublikasikan harus diarsipkan.'); return; }
    setBusy(true);
    const usageResponse = await fetch(`/api/admin/templates/${template.id}`, { cache: 'no-store' });
    const usageData = await usageResponse.json(); setBusy(false);
    if (!usageResponse.ok) { setMessage(statusMessage(usageData.code, usageData.message)); return; }
    const usage = usageData.usage as Usage;
    if (!usage.canDeletePermanently) { setMessage(`Draft tidak dapat dihapus karena masih dipakai: ${usage.gifts} gift, ${usage.publishedRevisions} revision, dan ${usage.publicGifts} public gift. Aset milik Draft sendiri akan dibersihkan saat dihapus.`); return; }
    if (!window.confirm(`Hapus Draft template “${template.name}”?\n\nMetadata Draft, source, hasil ekstraksi, manifest, dan asetnya akan dihapus. Tindakan ini tidak dapat dipulihkan.`)) return;
    setBusy(true); const response = await fetch(`/api/admin/templates/${template.id}`, { method: 'DELETE' }); const data = await response.json();
    setMessage(response.ok ? 'Template dihapus permanen.' : statusMessage(data.code, data.message)); setBusy(false); void load();
  }

  const activePipeline = pipeline[pipeline.length - 1];
  return <div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-moss">Dynamic Template Management</p><h1 className="mt-3 font-display text-5xl">Tambah Template</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60">Unggah satu HTML atau ZIP. Bloomora akan mengidentifikasi entry point, aset, dependensi, fitur eksplisit, dan membuat manifest untuk ditinjau.</p></div></div>

    <form onSubmit={analyze} className="mt-8 rounded-3xl border border-line bg-paper p-6 shadow-sm">
      <h2 className="font-display text-2xl">1. Unggah file template</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">ZIP dapat berisi HTML, CSS, JavaScript, gambar, font, audio, dan video. File diisolasi saat preview dan tidak dijalankan di server.</p>
      <label className="mt-5 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-moss/50 bg-ivory p-5 text-center">
        {upload?.name.toLowerCase().endsWith('.zip') ? <FileArchive size={22} className="text-moss" /> : <UploadCloud size={22} className="text-moss" />}
        <span className="text-sm font-semibold">{upload ? upload.name : 'Pilih satu file HTML atau ZIP'}</span>
        <span className="text-xs text-ink/50">Maksimum ZIP 50 MB · maksimum isi ekstraksi 100 MB dan 500 file</span>
        <input id="template-upload" type="file" accept=".html,.htm,.zip,text/html,application/zip" className="sr-only" onChange={(event) => { setUpload(event.target.files?.[0] ?? null); resetAnalysis(); }} />
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={busy || !upload} className="inline-flex items-center gap-2 rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Eye size={16} />} Analisis otomatis</button>{upload && <button type="button" disabled={busy} onClick={() => { setUpload(null); resetAnalysis(); const input = document.getElementById('template-upload') as HTMLInputElement | null; if (input) input.value = ''; }} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold">Bersihkan</button>}</div>
      {pipeline.length > 0 && <ol aria-label="Progres pemrosesan" className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{pipeline.map((step, index) => <li key={`${step}-${index}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${step === activePipeline ? 'bg-moss/10 font-semibold text-moss' : 'bg-ivory text-ink/65'}`}>{step === activePipeline && busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{pipelineLabels[step] ?? step}</li>)}</ol>}
      {message && <p role="status" className="mt-4 rounded-xl bg-ivory px-4 py-3 text-sm text-ink/70">{message}</p>}
    </form>

    {analysis && <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-3xl border border-line bg-paper p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-moss">2. Hasil analisis</p>
        <h2 className="mt-2 font-display text-2xl">{analysis.format === 'html' ? 'HTML terdeteksi' : analysis.format === 'react' ? 'Source React/TSX terdeteksi' : 'Format belum didukung'}</h2>
        <dl className="mt-4 grid grid-cols-[125px_1fr] gap-y-2 text-sm"><dt className="text-ink/50">Renderer</dt><dd>{analysis.renderer}</dd><dt className="text-ink/50">Entry point</dt><dd className="break-all">{analysis.entryPoint ?? 'Tidak ditemukan'}</dd><dt className="text-ink/50">Bahasa</dt><dd>{analysis.language === 'unknown' ? 'Belum dapat diidentifikasi' : analysis.language}</dd><dt className="text-ink/50">Fitur terdeteksi</dt><dd>{analysis.features.length ? analysis.features.join(', ') : 'Tidak ditemukan'}</dd></dl>
        <h3 className="mt-5 text-sm font-semibold">Berkas ({analysis.files.length})</h3><ul className="mt-2 max-h-36 space-y-1 overflow-auto rounded-xl bg-ivory p-3 text-xs">{analysis.files.map((file) => <li key={file.path} className="flex justify-between gap-3"><span className="break-all">{file.path}</span><span className="shrink-0 text-ink/45">{Math.ceil(file.size / 1024)} KB</span></li>)}</ul>
        {analysis.editableFields.length > 0 && <><h3 className="mt-5 text-sm font-semibold">Field yang secara eksplisit ditandai di HTML</h3><ul className="mt-2 space-y-1 text-xs text-ink/65">{analysis.editableFields.map((field) => <li key={field.key}><code>{field.key}</code> · {field.label} ({field.type})</li>)}</ul></>}
        {analysis.dependencies.external.length > 0 && <div className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 p-4"><h3 className="text-sm font-semibold text-amber-900">Dependensi eksternal belum diverifikasi</h3><ul className="mt-2 space-y-1 break-all text-xs text-amber-900/80">{analysis.dependencies.external.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul><p className="mt-2 text-xs leading-5 text-amber-900/80">Jangan menganggap URL tersebut tersedia. Kebijakan preview memblokir koneksi eksternal.</p></div>}
        {analysis.dependencies.missing.length > 0 && <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4"><h3 className="text-sm font-semibold text-rose">Aset lokal yang belum ditemukan</h3><ul className="mt-2 space-y-1 break-all text-xs text-rose/80">{analysis.dependencies.missing.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul><p className="mt-2 text-xs">Tambahkan berkas yang hilang ke ZIP sebelum menyimpan.</p></div>}
        {analysis.errors.length > 0 && <div className="mt-4 rounded-xl bg-rose/5 p-4 text-sm text-rose"><h3 className="font-semibold">Tidak dapat diproses</h3><ul className="mt-2 list-inside list-disc">{analysis.errors.map((error) => <li key={error}>{statusMessage(error)}</li>)}</ul></div>}
        {analysis.warnings.length > 0 && <div className="mt-4 rounded-xl bg-ivory p-4"><h3 className="text-sm font-semibold">Peringatan dan batas pemeriksaan</h3><ul className="mt-2 space-y-1 text-xs leading-5 text-ink/65">{analysis.warnings.map((warning) => <li key={warning}>• {statusMessage(warning)}</li>)}</ul><p className="mt-2 text-xs leading-5 text-ink/55">Deteksi viewport/CSS bukan pengujian responsif. Uji desktop dan mobile tetap perlu dilakukan manual.</p></div>}
      </div>
      <div className="rounded-3xl border border-line bg-paper p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-moss">3. Tinjau manifest</p><h2 className="mt-2 font-display text-2xl">Draf manifest JSON</h2><p className="mt-2 text-sm leading-6 text-ink/60">Nama, kategori, deskripsi, dan tag masih dapat diedit. Renderer, entry point, fitur, serta field editor dibandingkan lagi dengan hasil analisis sebelum disimpan.</p>
        <label className="sr-only" htmlFor="template-manifest">Manifest JSON yang dapat diedit</label><textarea id="template-manifest" value={manifestText} onChange={(event) => setManifestText(event.target.value)} spellCheck={false} rows={23} className="mt-4 w-full rounded-xl border border-line bg-[#171916] p-4 font-mono text-xs leading-5 text-[#edf0e8]" />
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Belum siap untuk katalog customer</p><p className="mt-1 text-xs leading-5 text-amber-900/80">HTML dapat dipreview secara terisolasi, tetapi belum masuk ke renderer, editor, draft, entitlement, dan published gift Bloomora. Tombol publikasi akan tetap diblokir sampai kontrak tersebut benar-benar tersedia.</p></div>
        <button type="button" disabled={busy || analysis.errors.length > 0 || !manifestText} onClick={() => void saveDraft()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />} Simpan draft & siapkan preview</button>
      </div>
    </section>}

    <section className="mt-8 rounded-3xl border border-line bg-paper"><div className="border-b border-line px-6 py-5"><h2 className="font-display text-2xl">Template yang diunggah</h2></div>{templates.length === 0 ? <p className="px-6 py-10 text-sm text-ink/55">Belum ada template dinamis.</p> : <div className="divide-y divide-line">{templates.map((template) => <div key={template.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><p className="font-semibold">{template.name} <span className="ml-2 rounded-full bg-ivory px-2 py-1 text-[10px] uppercase tracking-[.12em] text-ink/50">{statusLabel[template.status] ?? template.status}</span></p><p className="mt-1 text-xs text-ink/50">/{template.slug} · v{template.version} · {template.renderer} · entry: {template.entry_point ?? '-'}</p></div><div className="flex flex-wrap items-center gap-2">{template.renderer === 'custom-html' && ['ready_for_preview', 'published'].includes(template.status) && <button type="button" onClick={() => setPreviewId(template.id)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold"><Eye size={14} /> Preview terisolasi</button>}{template.status === 'ready_for_preview' && <button type="button" disabled title="Belum terintegrasi dengan renderer/editor customer" onClick={() => void publish(template.id)} className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink/45 disabled:cursor-not-allowed">Publikasi diblokir</button>}{template.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void changeStatus(template, 'archive')} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-semibold"><Archive size={14} /> Arsipkan</button>}{template.status === 'archived' && <button type="button" disabled={busy} onClick={() => void changeStatus(template, 'restore')} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-semibold"><RotateCcw size={14} /> Pulihkan</button>}{['draft', 'ready_for_preview', 'validation_failed'].includes(template.status) && <button type="button" disabled={busy} onClick={() => void remove(template)} className="inline-flex items-center gap-1 rounded-xl border border-rose/30 px-3 py-2 text-xs font-semibold text-rose disabled:opacity-50"><Trash2 size={14} /> Hapus Draft</button>}</div></div>)}</div>}</section>

    {previewId && <div role="dialog" aria-modal="true" aria-label="Preview template" className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/70 ${previewFullScreen ? 'p-0' : 'p-2 sm:p-5'}`}><div className={`flex w-full flex-col overflow-hidden bg-paper shadow-2xl ${previewFullScreen ? 'h-[100dvh] max-w-none rounded-none' : 'h-[96dvh] max-w-7xl rounded-2xl sm:rounded-3xl'}`}><div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-5"><div className="min-w-0"><p className="font-semibold">Preview sandbox HTML</p><p className="text-xs text-ink/50">JavaScript tanpa akses origin utama; koneksi eksternal, form, dan navigasi popup dibatasi.</p></div><div className="flex flex-wrap items-center justify-end gap-1.5"><button type="button" aria-pressed={previewMode === 'desktop'} onClick={() => setPreviewMode('desktop')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${previewMode === 'desktop' ? 'bg-moss text-ivory' : 'border border-line'}`}>Desktop</button><button type="button" aria-pressed={previewMode === 'mobile'} onClick={() => setPreviewMode('mobile')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${previewMode === 'mobile' ? 'bg-moss text-ivory' : 'border border-line'}`}>Mobile</button><button type="button" aria-pressed={previewFullScreen} aria-label={previewFullScreen ? 'Keluar dari layar penuh' : 'Lihat layar penuh'} onClick={() => setPreviewFullScreen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold">{previewFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{previewFullScreen ? 'Kecilkan' : 'Layar penuh'}</button><button type="button" aria-label="Tutup preview" onClick={() => { setPreviewId(null); setPreviewFullScreen(false); }} className="rounded-lg border border-line p-2"><X size={16} /></button></div></div><div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#e8e9e3] p-1.5 sm:p-3"><iframe title="Pratinjau HTML terisolasi" sandbox="allow-scripts" src={`/api/admin/templates/${previewId}/preview`} className="h-full min-h-0 rounded-lg border border-line bg-white shadow-sm" style={{ width: previewMode === 'mobile' ? '390px' : '100%', maxWidth: '100%' }} /></div></div></div>}
  </div>;
}
