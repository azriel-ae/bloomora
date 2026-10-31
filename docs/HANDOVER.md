# Handover Bloomora (untuk AI atau developer baru)

Baca dulu `docs/DECISIONS.md`, lalu `docs/PROGRESS.md`, dan `docs/ROADMAP.md` untuk semua tahap yang masih harus dikerjakan. Dokumen ini diperbarui dari kode aktual per 2026-11-01.

Checkpoint terbaru: Phase 5 (editor dan penyimpanan draft) telah selesai dan diverifikasi setelah pengguna menyetujuinya pada 2026-11-01. Phase 6 belum dimulai; wajib menunggu persetujuan eksplisit pengguna.

## Proyek

Bloomora adalah platform hadiah digital: pengguna memilih template, menulis hadiah, menerbitkannya, dan membagikan lewat URL publik unik. Dua bahasa (id, en). Stack dan struktur: `docs/ARCHITECTURE.md`. Target deploy: Vercel. Repositori tujuan: https://github.com/azriel-ae/bloomora.git

Kondisi awal (zip `bloomora-fixed.zip`) adalah scaffold UI: 3 template statis, editor tanpa penyimpanan, halaman publik placeholder, dashboard angka "-", paket hardcoded, halaman pembayaran/admin deskriptif. Klaim "sudah ada payment/QRIS/editor" di brief awal TIDAK sesuai kenyataan. Semua yang bukan tampilan di dokumen ini dibangun selama pengerjaan.

## Status phase

| Phase | Status |
|---|---|
| 1 Data model, entitlement, rules | Kode selesai. Unit test lulus. Rules belum diuji emulator |
| 2 Template engine | Selesai (unit test) |
| 3 Renderer dan Featured Demo | COMPLETED; build, lint, typecheck, unit, i18n, browser, dan pemeriksaan route lulus pada 2026-11-01 |
| 4 Katalog dan detail template | SELESAI; test unit, i18n, production build, browser katalog, dan regression browser lulus pada 2026-11-01 |
| 5 Editor dan penyimpanan draft | SELESAI; browser editor, unit, build, i18n, dan regresi katalog lulus |
| 6 dan seterusnya | Belum dimulai; ikuti gate persetujuan di roadmap |

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

Dibuat dan diubah dalam pengerjaan: lihat daftar per phase di `docs/CHANGELOG.md`. Phase 4 memindahkan konsumen UI dari registry lama ke engine, memperbarui middleware locale dan dokumentasi, serta menambah browser test katalog. `lib/templates.ts` dan `tests/unit/legacy-registry.test.ts` dihapus sesuai kriteria Phase 4; tidak ada dokumentasi lama yang dihapus.

## Hasil pengujian terakhir

Terbaru: `pnpm typecheck`, `pnpm lint`, `pnpm build` (29/29 halaman statis), 62/62 unit test, parity i18n (22 section), 119/119 regression browser Phase 3, dan `pnpm test:catalog` lulus. Browser katalog mencakup pencarian/filter/empty/reset, badges/demo, detail & eligibilitas paket, id → en dalam sesi sama, create selection, homepage, fallback `/g/demo`, editor preview, dan mobile. Tool Playwright/Chromium disediakan sementara di luar manifest. `pnpm test:rules` belum dijalankan karena butuh Firebase emulator. Rincian ada di `docs/PROGRESS.md`.

## Bug yang sudah diperbaiki

Lihat `docs/CHANGELOG.md` (Phase 1: migrasi legacy tidak tersimpan; Phase 3: spesifisitas CSS tombol, kebocoran fokus lightbox, tap highlight mobile, bilah atas mobile; Phase 4: locale prefiks kini mengalahkan cookie lama pada render pertama).

## Keterbatasan lingkungan pada snapshot awal

Pada snapshot tersebut sandbox tidak memiliki dependency atau akses jaringan, sehingga integrasi Next, lint, dan build belum pernah dijalankan. Dalam continuation 2026-11-01, dependency aplikasi dipasang dengan lockfile beku; esbuild/Playwright/Chromium untuk harness browser disediakan sementara di luar proyek, tanpa mengubah manifest atau lockfile.

## Pemeriksaan prasyarat (dilakukan pada continuation 2026-11-01)

1. `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`, `pnpm check:i18n`, serta `pnpm test:browser` sudah dijalankan; hasilnya ada di `docs/PROGRESS.md`.
2. Demo, katalog, dan create dibuka dari production build untuk locale id/en dan desktop/mobile; 12/12 pemeriksaan route lulus.
3. Clone `main` cocok dengan seluruh snapshot zip kecuali artefak build lokal; repository bersih sebelum perubahan closeout.
4. Konfirmasi dua divergensi di `docs/DECISIONS.md` dengan pengguna sebelum menyentuh `approveOrder` atau kuota.
5. Jangan menghubungkan Firebase atau mengaktifkan Blaze.

## Handover Phase 4 → Phase 5 (riwayat sebelum Phase 5 disetujui)

Phase 4 selesai: registry aktif menjadi sumber tunggal untuk katalog, detail, create, homepage, preview editor, fallback `/g/demo`, dan konteks chatbot. File legacy telah dihapus, dan hasil/keputusan dicatat di `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, serta `docs/ROADMAP.md`.

Langkah berikutnya adalah Phase 5: bangun editor berbasis `TemplateConfig`, penyimpanan draft lewat service/route yang sudah ada, konflik versi, preview `GiftView mode="preview"`, serta kontrol media yang jujur (rincian dan gate di `docs/ROADMAP.md`). **Jangan mulai sebelum pengguna menyetujuinya.** Jangan mengaktifkan Firebase/Blaze dan jangan ubah Model B atau aturan entitlement.

Pada checkpoint saat catatan ini ditulis, Phase 5 belum dimulai dan menunggu persetujuan; instruksi di atas adalah rekam jejak, bukan status terkini.

## Handover Phase 5 → Phase 6 (checkpoint terkini)

Phase 5 telah diimplementasikan: editor membaca `TemplateConfig`, preview bersama `GiftView`, draft melalui service/API, GET owner-only, autosave berbasis versi dan 409 reconciliation, expiry read-only, media disabled, serta sandbox memori khusus development yang eksplisit. Detail perubahan/hasil ada di `docs/ROADMAP.md`, `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, dan `docs/ARCHITECTURE.md`.

Verifikasi terbaru: `pnpm build` lulus (Next.js 15.5.28, 30/30 halaman statis), build menjalankan lint/typecheck, `pnpm test:unit` 65/65, `pnpm check:i18n` 22 section, `pnpm test:editor` lulus, dan `pnpm test:catalog` lulus. Firebase tidak terhubung; jangan menyatakan tes Firestore/auth produksi sudah dilakukan.

Langkah berikutnya adalah Phase 6 (publishing dan halaman publik `/g/[slug]`). **Berhenti dan tunggu persetujuan eksplisit pengguna sebelum mulai Phase 6.** Jangan mengaktifkan Firebase/Blaze, mengubah Model B, atau mengerjakan scope dashboard/pembayaran/media pada continuation ini. Push checkpoint Phase 5 ke `https://github.com/azriel-ae/bloomora.git`.
