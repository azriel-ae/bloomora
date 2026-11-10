# Dynamic Template Management

Admin membuka `/id/admin/templates` (atau locale aktif), mengisi metadata, lalu mengunggah ZIP atau file individual. Backend memvalidasi ukuran, jumlah file, path traversal, ekstensi berbahaya, `manifest.json`, renderer, dan entry point sebelum source disimpan ke bucket private `dynamic-templates`.

## Manifest minimum

```json
{
  "name": { "en": "A Quiet Letter", "id": "Surat yang Tenang" },
  "description": { "en": "...", "id": "..." },
  "category": "special-moments",
  "renderer": "custom-html",
  "entryPoint": "index.html"
}
```

`native` dan `custom-react` wajib menyertakan `contract: "bloomora-template-v1"`. Native harus mengikuti kontrak `TemplateConfig`/editor Bloomora; TSX tidak boleh dieksekusi dari Storage. Karena build worker terisolasi belum terpasang, endpoint publikasi menolak `custom-react` dengan status `react_build_worker_unavailable`. Custom HTML hanya dipreview melalui iframe sandbox di dashboard sampai renderer gift terintegrasi.

Status: `draft` → `processing` → `validation_failed` atau `ready_for_preview` → `published`. Upload berhasil tidak otomatis memublikasikan template. Hanya service-role server yang mengakses bucket; service-role key tidak pernah dikirim ke browser.

Migrasi `20261110000100_dynamic_templates.sql` harus dijalankan di Supabase SQL Editor/deployment pipeline sebelum endpoint digunakan.
