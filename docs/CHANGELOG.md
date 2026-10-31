# Changelog

Semua perubahan di bawah belum pernah dikompilasi oleh `next build` (lihat `docs/PROGRESS.md`).

## Dokumentasi

- `docs/ROADMAP.md`: rincian Phase 4 sampai 9 dan tahap Firebase, keamanan, deployment.

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
