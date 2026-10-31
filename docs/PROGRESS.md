# Bloomora: progres pengerjaan

Diperbarui: 2026-11-01. Status ditulis dari kondisi repository, bukan dari ingatan. Bukti ada di bagian "Hasil pengujian".

## Ringkasan status

| Tahap | Cakupan | Status |
|---|---|---|
| Phase 0 | Audit repository | SELESAI |
| Phase 1 | Data model, entitlement, service server, rules, migrasi timestamp | KODE SELESAI. Unit test lulus. Rules Firestore/Storage belum dijalankan di emulator |
| Phase 2 | Template engine | SELESAI (diuji unit) |
| Phase 3 | React renderer dan Featured Demo `chapter-of-us` | COMPLETED setelah typecheck, lint, build, unit, i18n, harness browser, dan pemeriksaan route lulus pada 2026-11-01 |
| Phase 4 | Katalog dan halaman detail template di atas engine | SELESAI (terverifikasi 2026-11-01) |
| Phase 5 | Editor dan penyimpanan draft | SELESAI — implementasi dan verifikasi 2026-11-01 |
| Phase 6 | Publishing dan halaman publik `/g/[slug]` | SELESAI — diverifikasi 2026-11-01 |
| Phase 7 | Analytics, Insights & Export / dashboard pemilik | IMPLEMENTASI INTI SELESAI — verifikasi akhir berjalan |
| Phase 8+ | Payment proof dan admin, template sampai 43, integrasi Firebase, uji keamanan, deployment | BELUM DIMULAI |

Penomoran Phase 4 dan sesudahnya mengikuti urutan prioritas yang Anda tulis. Pembagian nomor setelah Phase 4 adalah usulan saya, belum disepakati.

## Penutupan verifikasi Phase 3 — 2026-11-01

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit` (63/63), dan `pnpm check:i18n` lulus.
- `pnpm test:browser` lulus 119/119 dengan esbuild, Playwright, dan Chromium yang disediakan sementara di luar dependency proyek; `package.json` dan `pnpm-lock.yaml` tidak berubah.
- Rute `/demo/chapter-of-us`, `/templates`, dan `/create?template=chapter-of-us` diuji pada locale id/en dan viewport desktop/mobile: 12/12 merespons HTTP 200, selector konten ditemukan, tanpa error/warning console.
- `tests/rules/firestore.rules.test.ts` dikecualikan dari `pnpm typecheck` aplikasi karena dependensi emulator `@firebase/rules-unit-testing` tidak ada dalam instalasi proyek; `pnpm test:rules` tetap belum dijalankan.
- Batas dokumen Firestore memiliki pengecualian lint lokal yang dijelaskan; dokumen tetap divalidasi oleh service/domain setelah dibaca.
- Phase 4 belum dimulai dan tetap menunggu persetujuan pengguna.

## Phase 3: hasil akhir

Dibuat:
- Renderer React yang dipakai bersama: `components/gift/` (`gift-view.tsx` sebagai pintu masuk tunggal, `gift-experience.tsx` sebagai shell, `sections.tsx`, `parts.tsx`, `gift.css`).
- Logika interaksi yang murni dan teruji: `lib/engine/interaction.ts`. Ilustrasi SVG original sebagai data: `lib/engine/plates.ts` (8 plate). Token tema dan fallback varian: `lib/engine/theme-vars.ts`. Label UI: `lib/engine/labels.ts` dan namespace `gift` di `messages/*.json`.
- Halaman `/demo/chapter-of-us`, `components/featured-demo-band.tsx` (band Featured Demo di `/templates`), `components/chrome-gate.tsx` (menyembunyikan header/footer/chatbot di `/demo/*`), `components/demo-language-toggle.tsx`, parameter `?template=` di `/create`.
- Alur demo: segel surat, sampul editorial, surat, linimasa bab, galeri plate dengan lightbox, kartu alasan yang bisa dibuka dan ditutup, catatan apresiasi, penutup. Musik hanya muncul bila audio tersedia.
- Harness browser nyata: `tests/browser/`.

Bug yang ditemukan saat verifikasi dan sudah diperbaiki: lihat `docs/CHANGELOG.md`.

## Catatan historis: belum terverifikasi pada snapshot awal (2026-10-31)

- `pnpm typecheck` (tsc seluruh proyek), `pnpm lint`, dan `pnpm build` BELUM DIJALANKAN: `node_modules` dan `pnpm` tidak ada di sandbox, dan tidak ada jaringan. Integrasi Next (App Router, `ChromeGate`, halaman demo server component, `generateMetadata`, impor CSS dari komponen client, `searchParams` di `/create`) belum pernah dikompilasi oleh Next.
- Hanya Chromium yang diuji (emulasi mobile 390x844). Firefox, Safari, dan perangkat nyata belum.
- Font di screenshot adalah fallback sistem sandbox. Tampilan Bodoni/Didot/Palatino/Georgia di perangkat nyata belum dilihat.
- Audio diuji dengan file WAV senyap buatan; belum ada audio nyata karena Storage belum ada.
- Rules Firestore dan Storage belum divalidasi emulator.

Kriteria closeout yang tercatat di snapshot awal adalah `pnpm install && pnpm typecheck && pnpm lint && pnpm build` lulus dan halaman `/demo/chapter-of-us` dibuka dari hasil build. Kriteria tersebut telah dipenuhi pada verifikasi 2026-11-01 di bagian atas.

## Hasil pengujian pada snapshot awal (2026-10-31)

| Pengujian | Hasil | Catatan |
|---|---|---|
| `pnpm test:unit` (Node 22.22.2, tanpa jaringan) | 63 lulus, 0 gagal | 7 file. Engine, entitlement, service, slug, migrasi, logika interaksi |
| `pnpm test:browser` (Chromium, Playwright 1.56, bundel esbuild) | 119 dari 119 lulus | Dijalankan berulang kali, hasil stabil. Mencakup desktop, mobile, ID, EN, reduced motion, konten penuh/kosong/sebagian, audio ada/tidak ada URL, preview terbenam, keyboard, konten berbahaya, render server dan hydration |
| `pnpm check:i18n` | lulus (23 section) | |
| `tsc --strict` pada modul TS murni (`lib/engine`, `lib/model`, `lib/server/services`, `lib/entitlements`, dan sejenisnya) | lulus | Dijalankan langsung dengan tsc global |
| `tsc` pada route, `http.ts`, `runtime.ts`, TSX baru | lulus terhadap STUB module eksternal | Hanya 4 error artefak stub (tipe event). Bukan pengganti typecheck penuh |
| `pnpm typecheck` penuh | TIDAK DIJALANKAN | `node_modules` tidak ada |
| `pnpm lint` | TIDAK DIJALANKAN | eslint tidak terpasang |
| `pnpm build` | TIDAK DIJALANKAN | next tidak terpasang |
| `pnpm test:rules` | TIDAK DIJALANKAN | firebase-tools dan @firebase/rules-unit-testing tidak terpasang. File tes ada |

## Hasil pengujian terbaru (2026-11-01)

| Pengujian | Hasil | Catatan |
|---|---|---|
| `pnpm typecheck` | LULUS | `tests/rules` dikecualikan karena dependency rules emulator tidak disertakan dalam instalasi proyek |
| `pnpm lint` | LULUS | Tidak ada warning/error ESLint |
| `pnpm build` | LULUS | Next.js 15.5.28, 28 halaman statis berhasil dibuat |
| `pnpm test:unit` | 63 lulus, 0 gagal | Node 22 |
| `pnpm check:i18n` | LULUS | Parity 23 section |
| `pnpm test:browser` | 119/119 lulus | Chromium, Playwright, dan esbuild sementara di luar manifest proyek |
| Pemeriksaan route produksi | 12/12 lulus | id/en, desktop/mobile; HTTP 200 dan tanpa error/warning console |
| `pnpm test:rules` | TIDAK DIJALANKAN | Memerlukan Firebase emulator dan dependency yang tidak ada; bukan bagian closeout Phase 3 |

## Penutupan Phase 4 — 2026-11-01

- Sumber katalog, kartu, detail, create, homepage, editor preview, fallback `/g/demo`, dan konteks chatbot disatukan ke `lib/engine/registry.ts`. Registry `lib/templates.ts`, tes sinkronisasi legacy, serta namespace pesan per-slug yang tak terpakai dihapus.
- `/templates` mendukung pencarian dua bahasa, filter `CATEGORIES`, hasil kosong/reset, badge status, loading/error boundary, dan demo hanya untuk template `hasDemo`. Preview tiap template dirangkai dari data config (theme, section variants, dan sample), bukan screenshot yang sama.
- Halaman detail menampilkan section, tier, dan paket eligible dari seed aktif; informasi tidak mengklaim memeriksa akun dan keputusan harga final tetap di server saat checkout. CTA mempertahankan id template dan memakai alur auth yang ada.
- Browser test menemukan bug locale: prefiks `/en/...` sebelumnya baru mengubah cookie response, sehingga render pertama dapat memakai cookie lama. Middleware diperbaiki; perpindahan id → en dalam sesi yang sama kini lulus.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` (Next.js 15.5.28; 29/29 halaman statis dibuat), `pnpm test:unit` (62/62), dan `pnpm check:i18n` (22 section) lulus.
- `pnpm test:browser`: 119/119 lulus. `pnpm test:catalog`: lulus, termasuk search, kategori, empty/reset, demo, detail/paket, id/en, query template create, homepage, `/g/demo`, editor preview, dan mobile.
- Dependency browser (Playwright/Chromium) tetap disediakan sementara di luar manifest proyek. `pnpm test:rules` tidak dijalankan; tidak diperlukan untuk Phase 4 dan memerlukan Firebase emulator.

## Penutupan Phase 5 — 2026-11-01

- Editor kini data-driven dari `TemplateConfig` (field dan list) dengan preview langsung `GiftView mode="preview"`; sample preview tidak ditulis sebagai isi draft.
- Draft dibuat, dibaca, dan disimpan melalui service/route server. GET hanya memberi akses ke pemilik; entitlement habis menghasilkan view read-only, sedangkan save memakai debounce + optimistic `expectedVersion`. Konflik 409 memerlukan reload/reconciliation eksplisit.
- `giftId` menggunakan `/editor/g/[giftId]`; `/editor/new?template=` membuat draft. Route lama `/editor/[giftId]` tetap ada sebagai alias slug template, `/editor/demo` menuju demo sungguhan.
- Sandbox tanpa Firebase hanya untuk development yang secara eksplisit diaktifkan dengan `BLOOMORA_DEV_EDITOR=true`; store berada di memori proses, menampilkan warning, reset saat restart, dan tidak ada pada production. Media upload tetap nonaktif.
- Perbaikan middleware mempertahankan query string saat rewrite locale sehingga pilihan template tidak hilang; auth `next` dibatasi ke URL internal.
- Verifikasi: `pnpm build` lulus (30/30 static pages generated; Next juga lint/typecheck), `pnpm test:unit` 65/65, `pnpm check:i18n` 22 section, `pnpm test:editor` lulus, dan `pnpm test:catalog` lulus.
- Keterbatasan: Firebase nyata dan Firestore emulator tidak digunakan, sehingga auth/draft produksi terhadap Firebase dan rules tidak diklaim teruji. Phase publishing, dashboard, media, payment/admin, serta Phase 6 belum dimulai.

## Penutupan Phase 6 — 2026-11-01

- `getPublicGift` membaca `publicGifts/{slug}` melalui Env server dan tidak membaca subscription, owner, order, atau draft privat. Slug divalidasi dengan `isValidSlug`; state `published`, `archived`, dan `removed` dipisahkan.
- `/g/[giftSlug]` sekarang memilih template berversi dan merender konten persis melalui `GiftView mode="public"` tanpa `fillEmptyFrom`. State nonpublik diberi `noindex`; halaman `/g/` bersifat immersive tanpa header/footer/chatbot.
- Editor mendapatkan dialog konfirmasi publish berbasis `expectedVersion`, sehingga yang diterbitkan adalah versi yang sama dengan pratinjau tersimpan. Halaman publik menyediakan salin link, Web Share API dengan fallback salin, dan QR.
- Copy recipient, FAQ, dan expiration diperbarui dalam id/en agar sesuai Model B: paket mengatur hak pemilik, bukan umur gift yang sudah terbit.
- Verifikasi: `pnpm typecheck` lulus, `pnpm lint` lulus tanpa warning, `pnpm build` lulus (30/30 halaman), `pnpm test:unit` 66/66 lulus, dan `pnpm check:i18n` lulus (22 section).
- `pnpm test:catalog` dan `pnpm test:editor` lulus dengan Playwright/Chromium yang dipasang sementara di luar manifest project. Catalog mencakup fallback `/g/demo`, locale, mobile, dan regresi katalog; editor mencakup preview, create, autosave, konflik 409, expiry, media disabled, dan id/en. Public gift nyata dari Firebase/fixture server belum diuji karena Firebase belum terhubung; Firebase/Firestore emulator juga belum dijalankan.

## Checkpoint Phase 7 — implementasi inti 2026-11-01

- Dashboard tidak lagi memakai angka literal: `getDashboardData` menghitung gift total/draf/terbit/arsip, pending order, subscription, expiry, dan public views dari data server milik user.
- `giftAnalytics/{slug}` menyimpan aggregate view tanpa identitas visitor. Public page hanya mencatat view jika dokumen `publicGifts/{slug}` berstatus `published`; jalur public tidak membaca subscription.
- Insight menampilkan publication rate, total view, dan gift paling dilihat. Export owner-only tersedia sebagai JSON dan CSV dari `/api/dashboard/export?format=json|csv`; full draft content hanya keluar melalui boundary export yang terautentikasi.
- UI dashboard menampilkan gift cards, status, tanggal, jumlah view, link editor, link publik, dan state Firebase belum terhubung secara jujur.
- Verifikasi checkpoint: `pnpm typecheck` lulus, `pnpm test:unit` 67/67 lulus, `pnpm check:i18n` lulus 22 section. Build/lint dan browser regression Phase 7 belum dijalankan pada checkpoint ini.

## Pekerjaan berikutnya (belum dimulai, menunggu persetujuan)

Rincian per tahap dan kriteria: `docs/ROADMAP.md`. Phase 6 selesai dan diverifikasi pada 2026-11-01. Phase 7 Analytics, Insights & Export sedang diverifikasi; setelah closeout, langkah berikutnya adalah Phase 8 payment proof/admin dengan persetujuan eksplisit pengguna. Template sampai 43, integrasi Firebase, uji keamanan, dan deployment tetap sesudahnya.
