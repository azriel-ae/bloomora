# Bloomora: progres pengerjaan

Diperbarui: 2026-11-01. Status ditulis dari kondisi repository, bukan dari ingatan. Bukti ada di bagian "Hasil pengujian".

## Ringkasan status

| Tahap | Cakupan | Status |
|---|---|---|
| Phase 0 | Audit repository | SELESAI |
| Phase 1 | Data model, entitlement, service server, rules, migrasi timestamp | KODE SELESAI. Unit test lulus. Rules Firestore/Storage belum dijalankan di emulator |
| Phase 2 | Template engine | SELESAI (diuji unit) |
| Phase 3 | React renderer dan Featured Demo `chapter-of-us` | DIIMPLEMENTASIKAN DAN DIVERIFIKASI DI HARNESS BROWSER. BELUM BOLEH DISEBUT COMPLETED (lihat "Yang belum terverifikasi") |
| Phase 4 | Katalog dan halaman detail template di atas engine | BELUM DIMULAI |
| Berikutnya | Editor dan draft, publishing dan halaman publik `/g/[slug]`, dashboard, payment proof dan admin, template sampai 43, integrasi Firebase, uji keamanan, deployment | BELUM DIMULAI |

Penomoran Phase 4 dan sesudahnya mengikuti urutan prioritas yang Anda tulis. Pembagian nomor setelah Phase 4 adalah usulan saya, belum disepakati.

## Phase 3: hasil akhir

Dibuat:
- Renderer React yang dipakai bersama: `components/gift/` (`gift-view.tsx` sebagai pintu masuk tunggal, `gift-experience.tsx` sebagai shell, `sections.tsx`, `parts.tsx`, `gift.css`).
- Logika interaksi yang murni dan teruji: `lib/engine/interaction.ts`. Ilustrasi SVG original sebagai data: `lib/engine/plates.ts` (8 plate). Token tema dan fallback varian: `lib/engine/theme-vars.ts`. Label UI: `lib/engine/labels.ts` dan namespace `gift` di `messages/*.json`.
- Halaman `/demo/chapter-of-us`, `components/featured-demo-band.tsx` (band Featured Demo di `/templates`), `components/chrome-gate.tsx` (menyembunyikan header/footer/chatbot di `/demo/*`), `components/demo-language-toggle.tsx`, parameter `?template=` di `/create`.
- Alur demo: segel surat, sampul editorial, surat, linimasa bab, galeri plate dengan lightbox, kartu alasan yang bisa dibuka dan ditutup, catatan apresiasi, penutup. Musik hanya muncul bila audio tersedia.
- Harness browser nyata: `tests/browser/`.

Bug yang ditemukan saat verifikasi dan sudah diperbaiki: lihat `docs/CHANGELOG.md`.

## Yang belum terverifikasi (alasan Phase 3 belum COMPLETED)

- `pnpm typecheck` (tsc seluruh proyek), `pnpm lint`, dan `pnpm build` BELUM DIJALANKAN: `node_modules` dan `pnpm` tidak ada di sandbox, dan tidak ada jaringan. Integrasi Next (App Router, `ChromeGate`, halaman demo server component, `generateMetadata`, impor CSS dari komponen client, `searchParams` di `/create`) belum pernah dikompilasi oleh Next.
- Hanya Chromium yang diuji (emulasi mobile 390x844). Firefox, Safari, dan perangkat nyata belum.
- Font di screenshot adalah fallback sistem sandbox. Tampilan Bodoni/Didot/Palatino/Georgia di perangkat nyata belum dilihat.
- Audio diuji dengan file WAV senyap buatan; belum ada audio nyata karena Storage belum ada.
- Rules Firestore dan Storage belum divalidasi emulator.

Phase 3 boleh diubah menjadi COMPLETED setelah `pnpm install && pnpm typecheck && pnpm lint && pnpm build` lolos di mesin yang punya dependency, dan halaman `/demo/chapter-of-us` dibuka di browser dari hasil build.

## Hasil pengujian (aktual)

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

## Pekerjaan berikutnya (belum dimulai, menunggu persetujuan)

Rincian per tahap (cakupan, file, kriteria selesai, keputusan yang menunggu): `docs/ROADMAP.md`. Ringkasan:

1. Verifikasi Phase 3 di mesin dengan dependency (perintah di atas), perbaiki bila ada error.
2. Phase 4: katalog dan detail template dari engine. Ganti `lib/templates.ts` dan hapus tes `legacy-registry.test.ts` bersamaan.
3. Editor dan penyimpanan draft, memakai `GiftView mode="preview"`.
4. Publishing dan `/g/[slug]`, memakai `GiftView mode="public"`.
5. Dashboard, lalu payment proof dan admin, lalu template sampai 43.
6. Setelah aplikasi selesai: integrasi Firebase menyeluruh, uji emulator, uji keamanan, deployment.
