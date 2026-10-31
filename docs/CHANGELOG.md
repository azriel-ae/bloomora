# Changelog

Pada snapshot awal, perubahan belum pernah dikompilasi oleh `next build`. Closeout Phase 3 berikutnya lulus build pada 2026-11-01; lihat `docs/PROGRESS.md`.

## Dokumentasi

- `docs/ROADMAP.md`: rincian Phase 4 sampai 9 dan tahap Firebase, keamanan, deployment.

## [Phase 6] 2026-11-01: publishing dan halaman publik

- Mengganti placeholder `/g/[giftSlug]` dengan public-read server path yang hanya membaca `publicGifts`, memvalidasi slug, memilih template berversi, dan merender `GiftView mode="public"` tanpa isian contoh.
- Menambahkan state publik terpisah untuk gift terbit, diarsipkan, dicabut/dihapus, slug invalid, dan storage belum terkonfigurasi; state nonpublik memakai `noindex` dan halaman `/g/` menyembunyikan site chrome.
- Menambahkan dialog konfirmasi publish di editor berbasis `expectedVersion`, kontrol salin link/Web Share, dan QR publik. Audio tetap tidak muncul saat media upload nonaktif.
- Menyelaraskan copy id/en pada halaman recipient, FAQ, dan expiration dengan Model B: gift yang sudah terbit tidak kedaluwarsa hanya karena paket pemilik habis.
- Menambahkan unit test public-read yang membuktikan tidak ada subscription read dan gift tetap tersedia setelah waktu subscription berlalu.
- Lulus: typecheck, lint, production build (30/30 halaman), 66 unit test, i18n parity 22 section, serta `test:catalog` dan `test:editor` dengan Playwright/Chromium sementara di luar manifest. Public gift nyata dari Firebase/fixture server dan Firebase emulator belum digunakan.

## [Phase 7] 2026-11-01: Analytics, Insights & Export

- Mengganti placeholder dashboard dengan data server owner-only: gift total/draf/terbit/arsip, pending order, subscription, expiry, public views, gift cards, dan tautan aksi.
- Menambahkan aggregate `giftAnalytics/{slug}` tanpa identitas visitor, pencatatan view hanya untuk public gift berstatus `published`, serta insight publication rate dan gift paling dilihat.
- Menambahkan export JSON/CSV owner-only di `/api/dashboard/export`; data draft penuh tidak pernah dikirim ke dashboard, hanya melalui route export yang terautentikasi.
- Menambahkan copy id/en dashboard untuk analytics, insights, status, expiry, dan export.
- Checkpoint lulus: typecheck, 67 unit test, dan i18n parity 22 section. Build/lint/browser Phase 7 menunggu verifikasi berikutnya.

## [Phase 5] 2026-11-01: editor dan penyimpanan draft

- Mengganti editor mock dengan form dinamis `FieldDef`/`ListDef`, toggle section opsional, preview `GiftView mode="preview"`, dan status simpan nyata. Sample konten hanya untuk preview field kosong.
- Menambahkan `GET /api/gifts/[giftId]` owner-only. Draft tetap bisa dibaca read-only setelah paket berakhir; semua tulis tetap melalui service, pemeriksaan entitlement, dan `expectedVersion`.
- Menambahkan autosave debounce/single-flight, 409 reconciliation eksplisit, `beforeunload`, retry error sementara, create draft di `/editor/new?template=...`, dan edit di `/editor/g/[giftId]`. Route editor lama dipertahankan sebagai alias.
- Foto/audio ditandai belum tersedia. Sandbox browser tanpa Firebase berupa store process-memory yang hanya aktif dengan `NODE_ENV=development` serta `BLOOMORA_DEV_EDITOR=true`, menampilkan peringatan, tidak memakai localStorage/file, dan ditolak saat production.
- Auth continuation menggunakan path internal terverifikasi. Middleware locale mempertahankan query string saat rewrite; temuan browser sebelumnya akan kehilangan `?template=` telah dikunci oleh regression browser.
- Ditambahkan unit test autosave serta GET privat/expired, `tests/browser/editor.mjs`, dan script `pnpm test:editor`; regression `tests/browser/catalog.mjs` memeriksa alias editor demo menuju demo nyata.
- Lulus: production build (30/30 static pages generated; typecheck/lint build lulus), 65/65 unit test, parity i18n 22 section, browser editor lengkap, dan browser katalog.
- Batas: Firebase/Firestore emulator tidak terhubung, jadi integrasi autentikasi dan penyimpanan produksi tidak diklaim telah diuji. Phase 6 belum dimulai.

## [Phase 3 closeout] 2026-11-01: verifikasi integrasi

- `lib/server/store.ts`: pengecualian ESLint yang dijelaskan untuk tipe dokumen Firestore dinamis; validasi tetap dilakukan pada batas service/domain.
- `lib/server/firestore-store.ts`: adapter memakai alias `Doc` yang sama untuk hasil baca dan query.
- `tsconfig.json`: tes Firestore emulator dikecualikan dari typecheck aplikasi karena `@firebase/rules-unit-testing` tidak termasuk dependency proyek; tes emulator tetap terpisah dan belum dijalankan.
- Dependency sementara untuk harness browser dipasang di luar proyek; tidak ada perubahan pada `package.json` atau `pnpm-lock.yaml`.
- Lulus: `pnpm typecheck`, `pnpm lint`, `pnpm build`, 63 unit test, parity i18n, 119/119 tes browser, dan 12 pemeriksaan rute produksi untuk id/en serta desktop/mobile.
- Phase 4 belum dimulai; menunggu persetujuan pengguna.

## [Phase 4] 2026-11-01: katalog dan detail template dari engine

- Memindahkan katalog, kartu, detail, create, homepage, preview editor, fallback `/g/demo`, dan konteks chatbot ke konfigurasi aktif di `lib/engine/registry.ts`; pratinjau dibentuk dari theme, varian section, dan sample tiap template.
- Menambahkan search/filter kategori, empty/reset, badges, loading/error boundary, halaman detail dengan eligibilitas paket yang hanya bersifat informasi, CTA template terpilih, serta copy id/en.
- Menghapus `lib/templates.ts`, `tests/unit/legacy-registry.test.ts`, dan namespace pesan per-slug lama setelah pencarian kode aktif menunjukkan tak ada import tersisa.
- Memperbaiki `middleware.ts`: locale dari prefiks URL diterapkan pada request sebelum server component dirender, bukan hanya pada cookie response; browser test mereproduksi dan mengunci perpindahan id → en.
- Menambah `tests/browser/catalog.mjs` dan script `pnpm test:catalog`; tidak menambah dependency proyek/lockfile.
- Lulus: typecheck, lint, build (29/29 halaman statis), 62/62 unit test, parity i18n (22 section), 119/119 browser test Phase 3, dan browser test katalog/home/editor/fallback/mobile.
- Phase 5 (editor dan draft) belum dimulai; menunggu persetujuan eksplisit pengguna.

## [Phase 3] 2026-11-01: React renderer dan Featured Demo

Ditambahkan
- `components/gift/*`: renderer bersama (`GiftView`, `GiftExperience`, section, bagian bersama, stylesheet).
- `lib/engine/interaction.ts`, `plates.ts`, `theme-vars.ts`, `labels.ts`.
- `/demo/chapter-of-us`, `FeaturedDemoBand` di `/templates`, `ChromeGate`, `DemoLanguageToggle`.
- `?template=` di `/create` menampilkan template pilihan.
- Namespace `gift` dan `featuredDemo` di `messages/en.json` dan `id.json`, kunci `createPage.selectedTemplate`.
- `tests/browser/` (build, entry, render server, hydration, 119 pemeriksaan), `tests/unit/experience-logic.test.ts`.
- Script `test:browser`.

Diperbaiki (ditemukan lewat screenshot dan tes browser nyata)
- Tombol tampil sebagai teks polos: reset `button` berspesifisitas lebih tinggi dari `.bl-btn`. Kini memakai `:where()`.
- Ujung kertas surat mengintip dari amplop yang masih tersegel.
- Lengkung jembatan pada plate terbalik.
- Kartu alasan terlalu berat secara visual. Kini tertutup tenang dan terbuka menjadi blok aksen.
- `aria-labelledby` pada section menunjuk id yang tidak ada.
- Lightbox: fokus bisa bocor ke halaman di belakang setelah klik di dalam dialog (Tab keluar). Kini ditarik kembali ke dialog.
- Persegi biru tap highlight pada mobile. Backdrop lightbox terlalu transparan sehingga teks di belakang tembus.
- Bilah atas mobile memotong judul. Judul disembunyikan di layar sempit dan tombol menu hanya ikon (nama aksesibel tetap ada).

Perubahan pada file lama (semua aditif; tidak ada file dihapus)
- `app/layout.tsx`: header, chatbot, footer dibungkus `ChromeGate` (hanya menyembunyikan di `/demo/*`).
- `components/templates-page.tsx`: menyisipkan `<FeaturedDemoBand />`.
- `app/create/page.tsx`: menerima `searchParams.template`.
- `messages/*.json`, `package.json` (3 script), `tsconfig.json` (`allowImportingTsExtensions`).

## [Phase 2] 2026-11-01: Template engine

- `lib/engine/`: tipe, builder section dengan kosakata field baku, registry berversi (factory), `resolve.ts`, gerbang kualitas `validate-config.ts` (dua bahasa lengkap, tanpa emoji, kontras WCAG, varian valid, sample identik bentuknya).
- 4 template: `chapter-of-us` (featured, core), `pressed-garden`, `our-little-archive`, `just-a-letter`.
- Service server memvalidasi konten terhadap template. Publish menolak konten tidak lengkap (422 `incomplete_content`). Gift lama tetap bisa diedit dan dipublish terhadap versi template yang dipinnya meski template dinonaktifkan.
- `docs/template-engine.md`.

## [Phase 1] 2026-11-01: Data model, entitlement, rules

- `lib/model/*`, `lib/entitlements.ts`, `lib/packages.ts`, `lib/slug.ts`, `lib/features.ts` (`MEDIA_UPLOAD_ENABLED = false`).
- `lib/server/*` (service dengan transaksi atas interface `Store`, adapter Firestore Admin), route `/api/gifts`, `/api/gifts/[id]` (PUT, DELETE), `/publish`, `/state`, `/api/orders`, `/api/admin/orders/[orderId]`.
- Rules Firestore dan Storage (semua tulis dari client ditolak), indeks, `docs/data-model.md`.
- Planner migrasi timestamp ISO ke Timestamp (aditif, idempoten). Skrip penerapan belum ada.
- Diperbaiki: migrasi gift lama tidak tersimpan karena helper selalu memilih `tx.update` (ditemukan unit test).
- Route lama `PUT /api/gifts/[giftId]` diganti (tidak ada pemanggilnya) karena tanpa pemeriksaan entitlement.
