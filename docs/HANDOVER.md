# Handover Bloomora (untuk AI atau developer baru)

Baca dulu `docs/DECISIONS.md`, lalu `docs/PROGRESS.md`, dan `docs/ROADMAP.md` untuk semua tahap yang masih harus dikerjakan. Dokumen ini ditulis dari kode aktual per 2026-11-01.

## Proyek

Bloomora adalah platform hadiah digital: pengguna memilih template, menulis hadiah, menerbitkannya, dan membagikan lewat URL publik unik. Dua bahasa (id, en). Stack dan struktur: `docs/ARCHITECTURE.md`. Target deploy: Vercel. Repositori tujuan: https://github.com/azriel-ae/bloomora.git

Kondisi awal (zip `bloomora-fixed.zip`) adalah scaffold UI: 3 template statis, editor tanpa penyimpanan, halaman publik placeholder, dashboard angka "-", paket hardcoded, halaman pembayaran/admin deskriptif. Klaim "sudah ada payment/QRIS/editor" di brief awal TIDAK sesuai kenyataan. Semua yang bukan tampilan di dokumen ini dibangun selama pengerjaan.

## Status phase

| Phase | Status |
|---|---|
| 1 Data model, entitlement, rules | Kode selesai. Unit test lulus. Rules belum diuji emulator |
| 2 Template engine | Selesai (unit test) |
| 3 Renderer dan Featured Demo | Diimplementasikan, diverifikasi di harness browser. BELUM COMPLETED: next build/lint/typecheck belum bisa dijalankan |
| 4 dan seterusnya | Belum dimulai. Jangan mulai tanpa persetujuan pengguna |

## Kondisi Firebase dan database

TIDAK ADA koneksi. Tidak ada data produksi. Storage belum disediakan karena billing Blaze belum disetujui (JANGAN diaktifkan tanpa persetujuan). Rules dan indeks hanya berupa file. Pengujian logika memakai Fake Store. Jangan memakai localStorage atau file lokal sebagai pengganti database.

## Keputusan yang tidak boleh dilanggar

Model B (gift terbit tidak pernah kedaluwarsa karena paket habis), semua tulis lewat server, `gifts` privat terpisah dari `publicGifts`, draft tidak menimpa versi terbit, subscription hanya dari persetujuan admin, upload media nonaktif, tanpa emoji, satu Featured Demo. Daftar lengkap dan DUA DIVERGENSI (stacking perpanjangan belum diimplementasikan; kuota `maxGifts: 1` hanya asumsi): `docs/DECISIONS.md`.

## File penting

- `lib/entitlements.ts`, `lib/server/services.ts`, `lib/server/store.ts`: inti aturan akses dan transaksi.
- `lib/model/types.ts`, `content.ts`, `migrate.ts`: skema v2, validasi, migrasi.
- `lib/engine/*`, `lib/engine/templates/*`: template engine dan 4 template.
- `components/gift/*`: renderer. `app/demo/chapter-of-us/page.tsx`: demo.
- `firebase/*.rules`, `firebase/firestore.indexes.json`.
- `tests/unit`, `tests/browser`, `tests/rules`.

Dibuat dan diubah dalam pengerjaan: lihat daftar per phase di `docs/CHANGELOG.md`. File lama yang diubah (semua aditif): `app/layout.tsx`, `app/create/page.tsx`, `components/templates-page.tsx`, `messages/en.json`, `messages/id.json`, `package.json`, `tsconfig.json`, rules/indeks Firebase, dan route `app/api/gifts/[giftId]/route.ts` (diganti). Tidak ada file dihapus.

## Hasil pengujian terakhir

63 unit test lulus; 119 pemeriksaan browser lulus (Chromium); parity i18n lulus; tsc strict lulus pada modul murni. TIDAK dijalankan: `pnpm typecheck` penuh, `pnpm lint`, `pnpm build`, `pnpm test:rules`. Rincian di `docs/PROGRESS.md`.

## Bug yang sudah diperbaiki

Lihat `docs/CHANGELOG.md` (Phase 1: migrasi legacy tidak tersimpan; Phase 3: spesifisitas CSS tombol, kebocoran fokus lightbox, tap highlight mobile, bilah atas mobile, dan lainnya).

## Keterbatasan lingkungan pengembangan sebelumnya

Sandbox tanpa jaringan: tidak ada `pnpm install`, `next`, `eslint`, firebase-tools, dan tidak ada akses github.com. Karena itu integrasi Next, lint, build, dan emulator belum pernah dijalankan. Untuk uji browser, sandbox menyediakan Node 22, React 19.2, Playwright 1.56 dan Chromium, serta esbuild (dibawa `tsx`) secara global; harness `tests/browser/` memakainya lewat variabel `ESBUILD_PATH`, `REACT_NODE_PATH`, `PLAYWRIGHT_PATH`. Di mesin normal cukup `pnpm add -D esbuild playwright && npx playwright install chromium`.

## Pemeriksaan wajib sebelum mengubah kode

1. `pnpm install`, lalu jalankan `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit && pnpm check:i18n`. Perbaiki error yang muncul. Ini juga menentukan apakah Phase 3 boleh COMPLETED (koreksi `docs/PROGRESS.md` sesuai hasil).
2. Jalankan `pnpm dev`, buka `/demo/chapter-of-us` (id dan en, desktop dan mobile) dan `/templates`, `/create?template=chapter-of-us`; periksa console. Lalu `pnpm test:browser` bila esbuild dan playwright terpasang.
3. Periksa apakah `git log` repositori GitHub berisi perubahan pengguna yang tidak ada di snapshot ini.
4. Konfirmasi dua divergensi di `docs/DECISIONS.md` dengan pengguna sebelum menyentuh `approveOrder` atau kuota.
5. Jangan menghubungkan Firebase atau mengaktifkan Blaze.

## Instruksi untuk Phase 4 (setelah persetujuan pengguna)

Cakupan menurut urutan pengguna: katalog dan detail template di atas engine. Langkah konkret:
- Ganti sumber data `components/templates-page.tsx`, `template-card.tsx`, `app/templates/[slug]/page.tsx`, `app/create/page.tsx` dari `lib/templates.ts` ke `lib/engine/registry.ts`; hapus `lib/templates.ts` dan `legacy-registry.test.ts` bersamaan, serta kunci pesan per-slug yang tidak terpakai.
- Pencarian dan filter kategori memakai `searchCatalog` dan `CATEGORIES` (chip lama hanya `<span>`). Kartu: "Lihat Demo" hanya untuk template dengan `hasDemo` (sekarang hanya `chapter-of-us`) dan "Gunakan Template" untuk semua. Jangan membuat demo palsu untuk template lain; gunakan pratinjau statis dari data template atau tidak sama sekali, sesuai keputusan pengguna.
- Detail template: tampilkan section, kategori, tier dan paket yang eligible (dari `DEFAULT_PACKAGES`/`allowedTemplateTiers`), dua bahasa. Tambahkan kunci pesan ke `en.json` dan `id.json` dan jalankan `pnpm check:i18n`.
- Jangan tambahkan template atau demo baru di phase ini. Pertahankan gerbang `validateTemplateConfig` dan tes browser tetap hijau.
