# Bloomora: progres pengerjaan

Diperbarui: 2026-11-01. Status ditulis dari kondisi repository, bukan dari ingatan. Bukti ada di bagian "Hasil pengujian".

## Ringkasan status

| Tahap | Cakupan | Status |
|---|---|---|
| Phase 0 | Audit repository | SELESAI |
| Phase 1 | Data model, entitlement, service server, rules, migrasi timestamp | KODE SELESAI. Unit test lulus. Rules Firestore/Storage belum dijalankan di emulator |
| Phase 2 | Template engine | SELESAI (diuji unit) |
| Phase 3 | React renderer dan Featured Demo `chapter-of-us` | COMPLETED setelah typecheck, lint, build, unit, i18n, harness browser, dan pemeriksaan route lulus pada 2026-11-01 |
| Phase 4 | Katalog dan halaman detail template di atas engine | BELUM DIMULAI |
| Berikutnya | Editor dan draft, publishing dan halaman publik `/g/[slug]`, dashboard, payment proof dan admin, template sampai 43, integrasi Firebase, uji keamanan, deployment | BELUM DIMULAI |

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

## Pekerjaan berikutnya (belum dimulai, menunggu persetujuan)

Rincian per tahap (cakupan, file, kriteria selesai, keputusan yang menunggu): `docs/ROADMAP.md`. Ringkasan:

1. Verifikasi Phase 3 selesai pada 2026-11-01; hasil lengkap ada di bagian atas.
2. Phase 4: katalog dan detail template dari engine. Ganti `lib/templates.ts` dan hapus tes `legacy-registry.test.ts` bersamaan.
3. Editor dan penyimpanan draft, memakai `GiftView mode="preview"`.
4. Publishing dan `/g/[slug]`, memakai `GiftView mode="public"`.
5. Dashboard, lalu payment proof dan admin, lalu template sampai 43.
6. Setelah aplikasi selesai: integrasi Firebase menyeluruh, uji emulator, uji keamanan, deployment.
