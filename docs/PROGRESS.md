# Bloomora: progres pengerjaan

## Checkpoint 2026-11-08: upload MP3 "Gagal menyimpan di server" (upload langsung ke Storage)

- Gejala: setelah perbaikan 8c416b0 pesan berubah menjadi "Server gagal menyimpan media". Kode lama hanya punya tiga kode Storage dan membuang detail error; exception non-ServiceError (database, constraint, schema) keluar sebagai `media_server_failed` tanpa penyebab, dan respons non-JSON (mis. platform menolak body) jatuh ke pesan yang sama.
- Penyebab yang dikoreksi di kode: (1) MP3 dikirim multipart lewat Vercel Function, yang membatasi body sekitar 4,5 MB, sehingga sebagian besar MP3 ditolak sebelum route berjalan dan editor memetakannya ke pesan generik; (2) bucket `gift-media` yang tidak ada atau belum mengizinkan audio/mpeg hanya muncul sebagai kegagalan umum; (3) cleanup `bucket.remove` dapat melempar dan menutupi error asli; (4) satu objek audio yang hilang membuat seluruh GET signed URL (termasuk foto) gagal; (5) menghapus audio draf menghapus objek Storage walau revisi terbit masih memakainya.
- Alur audio baru: `POST /media/upload-url` (validasi edit link, versi, batas, tipe/ukuran yang dideklarasikan, memastikan bucket privat menerima audio, menerbitkan signed upload token untuk `private/{giftId}/{mediaId}.mp3`) -> browser mengirim byte langsung ke Storage dengan token itu -> `POST /media/complete` (membaca ulang objek, memeriksa ukuran dan signature MP3 asli, baru menulis `gift_media` dan referensi draf). `complete` idempotent untuk `mediaId` yang sama sehingga retry tidak membuat duplikat; objek yang isinya tidak sesuai dihapus; `abort` menghapus objek yatim bila klien menyerah. Foto tetap memakai route multipart lama; audio otomatis jatuh ke route lama bila klien Supabase publik tidak tersedia.
- Error kini membawa penyebab nyata: `media_bucket_missing`, `media_storage_mime_rejected`, `media_storage_too_large`, `media_storage_forbidden`, `media_storage_timeout`, `media_database_failed`, `media_database_schema_missing`, `media_object_missing`; respons berisi `detail` yang sudah disanitasi (URL database, JWT, token dihapus) dan editor menampilkannya.
- Keamanan tidak berubah: bucket tetap privat, RLS tetap aktif, service-role key hanya di server. Satu-satunya tindakan baru di server adalah `ensureMediaBucket` (service role) yang membuat/menyetel bucket `gift-media` tetap privat dengan batas 25 MB dan MIME audio/gambar sesuai migration, hanya bila konfigurasinya hilang atau menolak audio.
- Tes: `tests/unit/guest-media.test.ts` bertambah 9 test (klasifikasi error, init/complete terotorisasi, retry idempotent setelah kegagalan database, signature palsu dihapus, tidak bisa lintas hadiah, bucket hilang, perbaikan bucket tanpa membuka publik, ganti lagu + objek revisi terbit dipertahankan, signed URL toleran). Unit 130/131 lulus; satu-satunya gagal `qris-image` karena paket `@zxing/library` tidak terpasang di sandbox.
- BELUM terverifikasi: sandbox ini tanpa `node_modules`, tanpa jaringan, dan tanpa repositori git. `pnpm typecheck`, `pnpm lint`, `pnpm build`, upload nyata ke Supabase/Vercel, dan pemutaran audio di browser harus dijalankan oleh pemilik; commit/push juga belum dilakukan dari sini. Tidak ada klaim sukses produksi.

## Checkpoint 2026-11-08: perbaikan upload audio guest

- Akar masalah upload audio bukan koneksi umum: exception dari Supabase Storage dapat keluar dari service tanpa respons JSON sehingga UI menampilkan pesan generik, dan browser/mobile yang memberi MIME kosong atau `application/octet-stream` untuk file `.mp3` ditolak sebelum signature MP3 diperiksa.
- Endpoint upload kini selalu mengembalikan kode error JSON yang terklasifikasi untuk izin Storage, timeout, kegagalan Storage/server, ukuran, format, signature, rate limit, dan jaringan. Validasi tetap fail-closed: ekstensi hanya dipakai untuk inferensi MIME yang hilang; signature file tetap wajib cocok. Bucket `gift-media` tetap privat dan tidak ada perubahan RLS/policy.
- Nama file yang sudah disanitasi dipertahankan sebagai metadata opsional pada referensi media, sehingga editor menampilkan nama audio yang benar setelah upload dan setelah refresh. Path tetap scoped `private/{giftId}/...`, signed URL tetap server-mediated, dan preview/editor/public renderer tetap memakai referensi audio yang sama tanpa autoplay.
- Regresi ditambahkan untuk MP3 valid dengan MIME kosong/octet-stream, file format salah, batas ukuran, guest edit-token, batas satu audio, cleanup, dan error permission Storage. Checkpoint `8c416b0` sudah dipush ke `main`.
- Verifikasi kode: `pnpm test:unit` 125/125, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`, `pnpm test:supabase` 4/4, `pnpm build`, dan `git diff --check` lulus. Lint hanya memberi warning lama pada `<img>` dan dependency `useEffect`.
- Supabase Storage production/RLS live, upload multipart melalui browser nyata, dan pemutaran pada perangkat mobile fisik belum dapat diverifikasi di sandbox ini karena kredensial/storage live dan Playwright tidak tersedia. Jangan menyatakan verifikasi live tersebut selesai tanpa menjalankannya pada environment deployment.

## Follow-up 2026-11-08: Demo Utama scrapbook di production

- Melalui `/admin/featured-demo`, pilihan production diubah dari `chapter-of-us` menjadi `for-you-scrapbook`; dashboard menampilkan status tersimpan. GET publik `/api/featured-demo` mengembalikan `{ "templateId": "for-you-scrapbook" }`.
- HTML homepage masih menampilkan pilihan lama karena route root sebelumnya terprerender. Route homepage kini `force-dynamic` agar artwork dan link Demo membaca setting terbaru per request. Perubahan kode perlu dipush dan deployment live perlu dicek ulang.

## Follow-up 2026-11-08: UX pengaturan Demo admin

- Pada sesi browser admin yang diambil alih pengguna, sidebar `Pengaturan Demo Utama` mengarah ke `/admin/featured-demo` dan manager tampil setelah login. Dropdown menampilkan katalog aktif; mengubah pilihan lokal ke `pressed-garden` memperbarui preview dan mengaktifkan tombol simpan, lalu state UI dikembalikan ke `chapter-of-us` tanpa menyimpan.
- API admin GET mengembalikan `chapter-of-us` (200); PUT ulang nilai yang sama juga berhasil (200), sehingga endpoint, database, dan izin simpan live berfungsi untuk pilihan saat ini. Pilihan production tidak diganti saat diagnosis. Label sidebar, judul, petunjuk, status tersimpan, dan tombol diperjelas agar admin tahu harus memilih lalu menekan Simpan untuk mengubah halaman Demo publik.
- Belum diuji penyimpanan template alternatif di production/refresh navbar sesudahnya agar halaman publik tidak berganti tanpa pilihan eksplisit pengguna. Tes PGlite sebelumnya menguji persistence lintas request/store. E2E browser untuk desktop/mobile masih belum dapat dijalankan karena Playwright tidak terpasang.

## Koreksi 2026-11-08: homepage tetap landing page, demo pilihan dinamis

- Pemeriksaan public site membuktikan root masih memiliki landing page, tetapi `GiftView` penerima hadiah ukuran penuh ditambahkan tepat setelah hero dan mendominasi viewport. Renderer penuh itu dihapus dari homepage; hero mempertahankan artwork template yang terpilih dan CTA demo membuka template terpilih. Navbar desktop/mobile membaca ID dari GET publik `/api/featured-demo` (tanpa auth, no-store), lalu memakai href `/demo/{templateId}`; `/demo` tetap menjadi redirect fallback dinamis.
- Admin preview diberi React key dari template ID supaya renderer reset ketika dropdown berubah. Alias `/editor/demo` ikut menuju pilihan terbaru; URL hadiah pelanggan `/g/[slug]` tidak disentuh. API sekarang mengembalikan instruksi jelas saat tabel `site_settings` belum ada dan UI menunjuk ke migration yang perlu dijalankan.
- Integrasi PostgreSQL/PGlite memverifikasi pilihan admin tersimpan dan terbaca kembali dari store/request baru setelah migration, menolak non-admin/template invalid, membuat audit log, dan migration RLS menutup table dari anon/authenticated.
- Saat follow-up live, PUT admin untuk nilai aktif yang sama merespons 200, jadi jalur simpan production dapat digunakan; migration/settings tersedia di database yang dilayani aplikasi. Validasi kode sebelumnya: typecheck, 122 unit tests, 4/4 tes Supabase, lint, i18n, production build, syntax check tes browser, dan `git diff --check` lulus. E2E tetap belum dijalankan karena Playwright tidak tersedia.

## Checkpoint 2026-11-08: tingkat bunyi balasan chatbot

- Bunyi reply yang sebelumnya memakai sinus tunggal dengan gain 0,035 diganti cue dua nada berkarakter triangle pada gain puncak 0,22, ramp 15 ms, dan durasi total sekitar 0,41 detik. Ini menaikkan sinyal sekitar 16 dB, tetap di bawah 0,25 untuk menyisakan headroom.
- Permintaan lanjutan menegaskan suara harus selalu aktif: tombol speaker on/off, state mute, dan preferensi lokal dihapus. Tiap balasan sukses non-kosong yang selesai memicu notif; membuka chatbot atau response gagal tetap senyap. Pengiriman pesan membuka AudioContext dalam user gesture agar kebijakan autoplay browser terpenuhi.
- Generator dipisah ke `lib/chat-notification.ts`; tes memeriksa frekuensi, gain, jumlah nada, AudioContext suspended, dan notifikasi mandatory. Verifikasi sesi ini: typecheck lulus, unit tests 122/122 lulus, lint lulus (warning existing di payment components), production build dan `git diff --check` lulus; test browser/catalog tidak dapat berjalan karena paket `playwright` tidak tersedia di instalasi proyek.
- Belum diukur pada speaker fisik atau seluruh browser/perangkat; browser dapat membatasi audio sampai ada interaksi pengguna pertama.

## Checkpoint 2026-11-08: Featured Demo persisten dan dapat dipilih admin

- Admin Dashboard kini memiliki halaman Featured Demo: admin memilih template aktif, melihat pratinjau melalui `GiftView` dan sample content template, lalu menyimpan satu pilihan melalui API admin yang memverifikasi klaim admin.
- Nilai disimpan pada collection `site_settings` (migration baru `20261108000100_featured_demo_setting.sql`), dengan audit log, validasi template aktif, dan fallback ke template aktif yang tersedia jika setting kosong/usang atau database tidak tersedia.
- Beranda dan katalog membaca setting server-side; hero artwork dan link Demo di beranda memakai template pilihan. Full interactive recipient view berada di `/demo/[templateId]`, bukan di homepage. Demo khusus `/demo/chapter-of-us` tetap dipertahankan.
- Validasi checkpoint: `pnpm typecheck`, `pnpm test:unit` (120/120), dan `git diff --check` lulus. Lint, i18n, dan production build sedang diverifikasi sebelum push; Supabase migration/live behavior belum diuji.
- Belum selesai dari brief: scrapbook unggulan dengan pembuka amplop/letter/flower/music original; upgrade katalog luas; editor spesifik struktur yang melampaui fields/lists saat ini; stable per-slot photo IDs dan kontrol foto/audio per-bagian; tes UI admin/feature selection di browser serta mobile/device. Jangan menyatakan brief penuh selesai.

Diperbarui: 2026-11-06. Checkpoint QRIS/cleanup/CTA paling baru di bawah; checkpoint Indonesian-only/domain/chat dan checkpoint historis tetap dipertahankan. Supabase masih menjadi backend aktif; migrasi PostgreSQL belum cutover ke runtime.

## Checkpoint 2026-11-07: guest media sebelum pembayaran

- Guest yang memiliki edit-token valid dapat mengunggah foto dan satu musik ke bucket `gift-media` privat sebelum checkout atau pembayaran. Status order/subscription tidak dipakai sebagai satu-satunya izin; ownership draft tetap diverifikasi server-side.
- Ditambahkan rate limit terpisah untuk upload, hapus, dan pembuatan signed URL media, batas file 25 MB, signature/type validation, batas sementara 100 foto dan satu audio per draf, serta cleanup object saat transaksi optimistic gagal.
- Validasi entitlement paket tetap dilakukan di server saat checkout: jumlah foto dan ketersediaan musik pada `packageSnapshot` menentukan paket yang boleh dipilih. Media tidak dihapus otomatis ketika paket tidak cocok; pelanggan kembali ke editor untuk menyesuaikan.
- Pesan error upload kini membedakan format, ukuran, signature, link edit, rate limit, dan batas audio. Preview editor membaca signed URL dari draft yang tersimpan sehingga media tetap muncul setelah refresh.
- Verifikasi checkpoint: typecheck lulus, seluruh unit test 118/118 lulus termasuk guest foto/audio tanpa subscription, lint lulus dengan warning existing, dan `git diff --check` lulus. Supabase Storage live/RLS production belum diuji.

## Checkpoint 2026-11-06: QRIS, cleanup, dan CTA homepage

- Upload QRIS admin kini menyiapkan preview crop otomatis atau pilihan area manual tanpa mengaktifkan gambar sumber. Crop hanya disimpan setelah dikonfirmasi; server memeriksa payload EMVCo/CRC, quiet zone, rasio, decode dari gambar sumber dan hasil PNG, lalu mewajibkan payload keduanya sama. QRIS aktif harus memiliki path crop dan status `confirmed`; QR legacy/unverified ditolak.
- `QrisPaymentCard` adalah renderer yang sama untuk preview admin dan detail order pelanggan. QR tetap utuh pada area putih, dekorasi Bloomora berada di luar area scan, logo opsional hanya aset lokal, pelanggan dapat mengunduh kartu PNG, dan tiap order mempertahankan snapshot desainnya sendiri. Endpoint gambar pelanggan memerlukan token akses order.
- Cleanup berbasis referensi menghapus `components/publish-dialog.tsx` dan `lib/brand.ts` yang tidak digunakan, serta dependency `react-hook-form`/`@hookform/resolvers`; `@zxing/library` hanya dev dependency untuk fixture test. Tidak ada migration/schema/RLS yang dihapus.
- Tombol header **Buat hadiah** (desktop/mobile) dan dua CTA template di beranda kini menuju eksplisit `https://bloomora.my.id/templates`. Pengguna melaporkan aturan Vercel telah disesuaikan agar domain apex tanpa `www` digunakan; dashboard tidak diperiksa ulang di checkpoint ini.
- Verifikasi lulus: `pnpm typecheck`, `pnpm lint` (warning non-blocking existing `no-img-element` dan satu dependency `useEffect`), `pnpm test:unit` (115/115), `pnpm test:supabase` (3/3), `pnpm check:i18n` (26 bagian), `pnpm build`, renderer browser (111/111), `pnpm test:catalog`, dan `pnpm test:editor`. Playwright, esbuild, dan Chromium untuk suite browser disediakan sementara di luar dependency proyek.

## Checkpoint 2026-11-06: UI Bahasa Indonesia, domain resmi, dan bunyi balasan chat

- Seluruh UI aplikasi disederhanakan ke Bahasa Indonesia: locale provider, kamus aktif, header/admin, metadata SEO, demo, editor, dan tes tidak lagi menawarkan English. Cookie pilihan bahasa lama dibersihkan; URL legacy `/id/...` dan `/en/...` dialihkan ke route tanpa prefix, sementara render internal tetap memakai Bahasa Indonesia.
- `https://bloomora.my.id` menjadi origin resmi untuk metadata, canonical URL, Open Graph, sitemap/robots, tautan hadiah/QR/edit/recovery. `NEXT_PUBLIC_SITE_URL` dicatat pada `.env.example` dan README; utilitas menolak origin selain domain resmi. Inspeksi Vercel hanya-baca menemukan variabel `NEXT_PUBLIC_SITE_URL` belum tersedia; domain apex berstatus valid tetapi redirect 308 ke `www.bloomora.my.id`, sementara `www` terpasang ke Production. Tidak ada pengaturan project yang diubah; sesi browser Vercel sudah logout sesuai instruksi pengguna.
- Chatbot memiliki toggle suara lokal yang default mati; bunyi Web Audio ringan hanya dipicu setelah balasan berhasil selesai, tidak pada balasan gagal atau saat mute. Tidak ada asset audio eksternal.
- Validasi akhir lulus: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (111/111), `pnpm check:i18n` (26 bagian), `pnpm build` (46 halaman statis), dan `git diff --check`. Lint hanya memberi warning non-blocking yang sudah ada untuk `<img>` serta dependency `useEffect`. Browser suite tidak dijalankan pada continuation ini; regresi baru tetap tercakup pada source tests.

## Checkpoint 2026-11-05: editor media, Payment Method, dan responsive renderer

- Editor guest sekarang memiliki `DELETE /api/guest/gifts/[giftId]/media` dengan edit-token, optimistic `expectedVersion`, soft-delete metadata `giftMedia`, dan penghapusan object Storage hanya jika path tidak direferensikan media lain. Draft gift berbayar tetap terpisah dari `publicGifts`.
- Payment Method tidak lagi mengekspos atau menerima status pemeriksaan QRIS/`Confirmed By`. Kontrak, service, adapter PostgreSQL, form admin, dan copy id/en hanya mengelola detail metode, gambar, dan status aktif. `reviewedBy` serta histori audit order tetap dipertahankan.
- Renderer bersama diberi guard responsive lintas seluruh template: overflow horizontal dipotong pada root, media dibatasi terhadap container, tombol memiliki target sentuh minimum, dan timeline menjaga kolom konten tetap menyusut.
- Validasi yang dijalankan: `pnpm typecheck`, `pnpm lint`, `pnpm build` (40 route), `pnpm test:unit` (102/102), dan `git diff --check`. Lint/build hanya memberi warning existing `no-img-element` pada gambar upload; Supabase live/browser visual/device nyata belum dijalankan.

## Ringkasan status

| Tahap | Cakupan | Status |
|---|---|---|
| Phase 0 | Audit repository | SELESAI |
| Phase 1 | Data model, entitlement, service server, rules, migrasi timestamp | KODE SELESAI. Unit test lulus; PostgreSQL rules emulator suite 8/8 lulus 2026-11-02 dengan dependency sementara. Storage rules belum diuji |
| Phase 2 | Template engine | SELESAI (diuji unit) |
| Phase 3 | React renderer dan Featured Demo `chapter-of-us` | COMPLETED setelah typecheck, lint, build, unit, i18n, harness browser, dan pemeriksaan route lulus pada 2026-11-01 |
| Phase 4 | Katalog dan halaman detail template di atas engine | SELESAI (terverifikasi 2026-11-01) |
| Phase 5 | Editor dan penyimpanan draft | SELESAI — implementasi dan verifikasi 2026-11-01 |
| Phase 6 | Publishing dan halaman publik `/g/[slug]` | SELESAI — diverifikasi 2026-11-01 |
| Phase 7 | Analytics, Insights & Export / dashboard pemilik | IMPLEMENTASI INTI SELESAI — verifikasi akhir berjalan |
| Phase 8 | Checkout, pembayaran, konfigurasi bisnis, verifikasi admin, dan penerbitan hadiah | IMPLEMENTASI APLIKASI SELESAI BERTAHAP; provider recovery/deployment masih memerlukan konfigurasi eksternal dan Supabase migration adalah pekerjaan aktif |
| Phase 9+ | Template sampai 43, uji keamanan, deployment | DITAHAN selama backend migration; rencana integrasi Supabase lama sudah digantikan Supabase |
| Supabase migration | Full backend replacement (DB, admin Auth, Storage, RLS, APIs, tests, docs) | SEDANG BERJALAN — checkpoint pertama: initial PostgreSQL schema migration dibuat; belum diterapkan/diuji pada Supabase dan runtime Supabase masih aktif |

Penomoran Phase 4 dan sesudahnya mengikuti urutan prioritas yang Anda tulis. Pembagian nomor setelah Phase 4 adalah usulan saya, belum disepakati.

## Penutupan verifikasi Phase 3 — 2026-11-01

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit` (63/63), dan `pnpm check:i18n` lulus.
- `pnpm test:browser` lulus 119/119 dengan esbuild, Playwright, dan Chromium yang disediakan sementara di luar dependency proyek; `package.json` dan `pnpm-lock.yaml` tidak berubah.
- Rute `/demo/chapter-of-us`, `/templates`, dan `/create?template=chapter-of-us` diuji pada locale id/en dan viewport desktop/mobile: 12/12 merespons HTTP 200, selector konten ditemukan, tanpa error/warning console.
- `tests/rules/postgres.rules.test.ts` dikecualikan dari `pnpm typecheck` aplikasi karena dependensi emulator `@supabase/rules-unit-testing` tidak ada dalam instalasi proyek; `pnpm test:rules` tetap belum dijalankan.
- Batas dokumen PostgreSQL memiliki pengecualian lint lokal yang dijelaskan; dokumen tetap divalidasi oleh service/domain setelah dibaca.
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
- Rules PostgreSQL dan Storage belum divalidasi emulator.

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
| `pnpm test:rules` | TIDAK DIJALANKAN | supabase-tools dan @supabase/rules-unit-testing tidak terpasang. File tes ada |

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
| `pnpm test:rules` | TIDAK DIJALANKAN | Memerlukan Supabase emulator dan dependency yang tidak ada; bukan bagian closeout Phase 3 |

## Penutupan Phase 4 — 2026-11-01

- Sumber katalog, kartu, detail, create, homepage, editor preview, fallback `/g/demo`, dan konteks chatbot disatukan ke `lib/engine/registry.ts`. Registry `lib/templates.ts`, tes sinkronisasi legacy, serta namespace pesan per-slug yang tak terpakai dihapus.
- `/templates` mendukung pencarian dua bahasa, filter `CATEGORIES`, hasil kosong/reset, badge status, loading/error boundary, dan demo hanya untuk template `hasDemo`. Preview tiap template dirangkai dari data config (theme, section variants, dan sample), bukan screenshot yang sama.
- Halaman detail menampilkan section, tier, dan paket eligible dari seed aktif; informasi tidak mengklaim memeriksa akun dan keputusan harga final tetap di server saat checkout. CTA mempertahankan id template dan memakai alur auth yang ada.
- Browser test menemukan bug locale: prefiks `/en/...` sebelumnya baru mengubah cookie response, sehingga render pertama dapat memakai cookie lama. Middleware diperbaiki; perpindahan id → en dalam sesi yang sama kini lulus.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` (Next.js 15.5.28; 29/29 halaman statis dibuat), `pnpm test:unit` (62/62), dan `pnpm check:i18n` (22 section) lulus.
- `pnpm test:browser`: 119/119 lulus. `pnpm test:catalog`: lulus, termasuk search, kategori, empty/reset, demo, detail/paket, id/en, query template create, homepage, `/g/demo`, editor preview, dan mobile.
- Dependency browser (Playwright/Chromium) tetap disediakan sementara di luar manifest proyek. `pnpm test:rules` tidak dijalankan; tidak diperlukan untuk Phase 4 dan memerlukan Supabase emulator.

## Penutupan Phase 5 — 2026-11-01

- Editor kini data-driven dari `TemplateConfig` (field dan list) dengan preview langsung `GiftView mode="preview"`; sample preview tidak ditulis sebagai isi draft.
- Draft dibuat, dibaca, dan disimpan melalui service/route server. GET hanya memberi akses ke pemilik; entitlement habis menghasilkan view read-only, sedangkan save memakai debounce + optimistic `expectedVersion`. Konflik 409 memerlukan reload/reconciliation eksplisit.
- `giftId` menggunakan `/editor/g/[giftId]`; `/editor/new?template=` membuat draft. Route lama `/editor/[giftId]` tetap ada sebagai alias slug template, `/editor/demo` menuju demo sungguhan.
- Sandbox tanpa Supabase hanya untuk development yang secara eksplisit diaktifkan dengan `BLOOMORA_DEV_EDITOR=true`; store berada di memori proses, menampilkan warning, reset saat restart, dan tidak ada pada production. Media upload tetap nonaktif.
- Perbaikan middleware mempertahankan query string saat rewrite locale sehingga pilihan template tidak hilang; auth `next` dibatasi ke URL internal.
- Verifikasi: `pnpm build` lulus (30/30 static pages generated; Next juga lint/typecheck), `pnpm test:unit` 65/65, `pnpm check:i18n` 22 section, `pnpm test:editor` lulus, dan `pnpm test:catalog` lulus.
- Keterbatasan: Supabase nyata dan PostgreSQL emulator tidak digunakan, sehingga auth/draft produksi terhadap Supabase dan rules tidak diklaim teruji. Phase publishing, dashboard, media, payment/admin, serta Phase 6 belum dimulai.

## Penutupan Phase 6 — 2026-11-01

- `getPublicGift` membaca `publicGifts/{slug}` melalui Env server dan tidak membaca subscription, owner, order, atau draft privat. Slug divalidasi dengan `isValidSlug`; state `published`, `archived`, dan `removed` dipisahkan.
- `/g/[giftSlug]` sekarang memilih template berversi dan merender konten persis melalui `GiftView mode="public"` tanpa `fillEmptyFrom`. State nonpublik diberi `noindex`; halaman `/g/` bersifat immersive tanpa header/footer/chatbot.
- Editor mendapatkan dialog konfirmasi publish berbasis `expectedVersion`, sehingga yang diterbitkan adalah versi yang sama dengan pratinjau tersimpan. Halaman publik menyediakan salin link, Web Share API dengan fallback salin, dan QR.
- Copy recipient, FAQ, dan expiration diperbarui dalam id/en agar sesuai Model B: paket mengatur hak pemilik, bukan umur gift yang sudah terbit.
- Verifikasi: `pnpm typecheck` lulus, `pnpm lint` lulus tanpa warning, `pnpm build` lulus (30/30 halaman), `pnpm test:unit` 66/66 lulus, dan `pnpm check:i18n` lulus (22 section).
- `pnpm test:catalog` dan `pnpm test:editor` lulus dengan Playwright/Chromium yang dipasang sementara di luar manifest project. Catalog mencakup fallback `/g/demo`, locale, mobile, dan regresi katalog; editor mencakup preview, create, autosave, konflik 409, expiry, media disabled, dan id/en. Public gift nyata dari Supabase/fixture server belum diuji karena Supabase belum terhubung; Supabase/PostgreSQL emulator juga belum dijalankan.

## Checkpoint Phase 7 — implementasi inti 2026-11-01

- Dashboard tidak lagi memakai angka literal: `getDashboardData` menghitung gift total/draf/terbit/arsip, pending order, subscription, expiry, dan public views dari data server milik user.
- `giftAnalytics/{slug}` menyimpan aggregate view tanpa identitas visitor. Public page hanya mencatat view jika dokumen `publicGifts/{slug}` berstatus `published`; jalur public tidak membaca subscription.
- Insight menampilkan publication rate, total view, dan gift paling dilihat. Export owner-only tersedia sebagai JSON dan CSV dari `/api/dashboard/export?format=json|csv`; full draft content hanya keluar melalui boundary export yang terautentikasi.
- UI dashboard menampilkan gift cards, status, tanggal, jumlah view, link editor, link publik, dan state Supabase belum terhubung secara jujur.
- Verifikasi checkpoint: `pnpm typecheck` lulus, `pnpm test:unit` 67/67 lulus, `pnpm check:i18n` lulus 22 section. Build/lint dan browser regression Phase 7 belum dijalankan pada checkpoint ini.

## Pekerjaan berikutnya (belum dimulai, menunggu persetujuan)

Rincian per tahap dan kriteria: `docs/ROADMAP.md`. Phase 6 selesai dan diverifikasi pada 2026-11-01. Phase 7 Analytics, Insights & Export sedang diverifikasi; setelah closeout, langkah berikutnya adalah Phase 8 payment proof/admin dengan persetujuan eksplisit pengguna. Template sampai 43, integrasi Supabase, uji keamanan, dan deployment tetap sesudahnya.

## Business flow update — 2026-11-01

Implementasi awal requirements baru:
- Guest draft API tersedia di `/api/guest/gifts` dan secure read/save di `/api/guest/gifts/[giftId]`.
- Edit token dibuat CSPRNG, disimpan hanya sebagai SHA-256 hash, diverifikasi constant-time, dan diberi expiry 30 hari.
- Custom slug dinormalisasi, reserved route names ditolak, dan reservation dilakukan server-side melalui `slugs/{slug}`.
- Model order menerima customer email/WhatsApp, payment method id, dan voucher code untuk fase checkout berikutnya.
- `lib/commerce.ts` menyediakan validasi voucher percent/fixed, minimum amount, usage limit, date window, serta filter payment method aktif.
- Public gift QR sekarang memiliki designer warna dan export PNG/SVG; QR hanya menerima public URL.
- Unit test secure token, custom slug, dan voucher ditambahkan.

Batas penting: guest flow ini baru draft/read/save foundation. Checkout guest, upload media/crop, payment proof, Resend recovery, admin CRUD voucher/payment method, dan approval-to-publish masih harus disambungkan pada phase 8+ dengan Supabase/Storage yang tervalidasi. Tidak ada pembayaran otomatis yang diklaim.


## Auth-only-admin continuation — 2026-11-02

Implemented the first account-free customer flow pass from the latest brief:

- Customer creation and saved-editor routes no longer require a Supabase customer session.
- The editor now creates, loads, saves, and reloads drafts through `/api/guest/gifts` using the existing high-entropy secure edit token stored for the browser session.
- Public navigation no longer exposes customer login.
- `/login` and `/register` are legacy redirects to `/admin/login`; the dedicated admin login page is available at `/admin/login`.
- Session creation now rejects Supabase ID tokens without the verified `admin: true` custom claim.
- Template detail CTA and copy now describe account-free guest creation.

Validation completed: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (70/70), and `pnpm build` (34/34 routes) passed.

Remaining scope from the brief is not yet complete: checkout/contact capture, server-side voucher pricing, payment-proof submission, admin transaction list/detail/filter/report UI, guest publish-after-approval, rate limiting, Supabase emulator/rules validation, and a durable secure edit-link recovery flow. Supabase remains unconfigured and no production data was changed.


## Phase 8 checkpoint — 2026-11-02

The first Phase 8 slice is implemented and pushed as a guest checkout and admin sales foundation. `/checkout` collects customer contact details, package selection, and an optional voucher without requiring an account. `/api/guest/orders` validates the secure edit token and recalculates package price and discount on the server before creating an `awaiting_payment` order. `/admin/orders` and `/api/admin/orders` provide admin-only transaction summaries, search, filters, confirmed-revenue totals, and publication state.

At that checkpoint, `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (70/70), and `pnpm build` (38/38 routes) passed. Payment-method/package/voucher CRUD are now completed in later checkpoints. Still pending: secure payment detail, proof submission (Storage blocker), admin verification, approval-to-publish, stacking, recovery/abuse controls, and remaining integration/rules tests. Supabase and Storage are still not configured; Phase 8 remains in progress.


## Status Tahap 8 — belum selesai (checkpoint 2026-11-02)

Fondasi yang sudah selesai: checkout guest, admin transaksi/config, atomic voucher reservation, secure order detail, admin order detail/audit dan proof-gated decisions, serta subscription stacking transactional. Checkpoint kode terbaru `b8766d284e0a4b0818f84412eb8f8ac427458629` (admin review `6b0de6fac1612e7f0a38965d866820c7043264a8`; guest detail `b9cc0ea0e20ccfcce2877258f825f57e21b65000`).

Pekerjaan yang belum selesai dan harus dilanjutkan: payment proof submission dan secure preview setelah Storage dikonfigurasi, guest approval-to-gift publication linkage, secure edit-link recovery, rate limiting/idempotency, cross-customer isolation, dan integration/browser/rules tests. Admin detail/audit/actions sudah ada, tetapi jalur bukti belum dapat digunakan end-to-end; server menolak keputusan bila proof metadata valid tidak ada.

Status final yang boleh ditulis AI berikutnya: **Tahap 8 sedang berjalan; checkout/sales, payment/package/voucher admin, secure order detail, admin review gates, dan subscription stacking selesai. Proof upload/preview (Storage blocker), guest order-to-publication linkage, recovery/abuse controls, serta emulator/rules/integration tests belum selesai. Tahap 9 jangan dimulai.**


## Tahap 8 continuation — metode pembayaran (2026-11-02)

- Implementasi pertama dari daftar tertunda selesai: CRUD admin metode pembayaran (buat/perbarui, aktif/nonaktif, sort order) melalui `paymentMethods/{id}`, validasi server, dan audit log. Endpoint admin memakai claim terverifikasi; endpoint publik hanya mengembalikan metode aktif.
- Checkout guest kini memuat pilihan/instruksi metode aktif dari server. `createGuestOrder` menolak ID yang tidak ditemukan atau nonaktif, termasuk fallback QRIS hardcoded sebelumnya. Pelanggan tetap tidak perlu login.
- Supabase Storage tetap tidak tersedia: instruksi hanya teks; upload gambar QRIS/bukti tidak diklaim tersedia.
- Verifikasi: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` 72/72, `pnpm check:i18n` (23 section), `pnpm build` (41/41 static pages) lulus. Supabase emulator, rules, dan browser end-to-end belum dijalankan.
- Commit kode: `c9e56992e54d8d134c7ee1da5dfd924d1d21a2fe` (sudah di-push ke `main`). Pekerjaan berikutnya: item #2, administrasi paket dengan snapshot order lama tetap tak berubah.


## Tahap 8 continuation — package administration (2026-11-02)

Package admin CRUD selesai pada `cf4374f3073f152c6b12d6806ee5b48254c52e9e` dan sudah di-push. Admin dapat mengubah nama, harga, durasi, status, urutan, gift/photo limits, musik/review entitlements, dan template tiers untuk paket tetap Basic/Plus/Premium. Pricing, template eligibility/detail, Featured Demo, dan checkout mengambil paket aktif dari service server. Test memverifikasi order lama tidak berubah saat paket diedit dan activation expiry tetap mengikuti snapshot.

Validasi checkpoint package: typecheck, lint, unit 73/73, i18n parity 24 sections, production build, dan catalog browser regression lulus. Layanan Supabase emulator/rules belum dijalankan. Voucher CRUD/reservasi yang saat itu menjadi langkah berikutnya telah selesai pada `120c24a`; tugas aktif sekarang adalah payment instructions/order detail (lihat handover terbaru). Storage masih blocker untuk file bukti.


## Tahap 8 continuation — voucher administration (2026-11-02)

Voucher admin/soft-delete dan reservation atomik selesai pada `120c24a66fbdeedaebac49aaf0736418328ce632`, sudah di-push. Order transaction memvalidasi definisi dan periode voucher, menghitung diskon dari harga paket server, menaikkan `usedCount`, lalu membuat order dalam transaksi yang sama. Counter tidak berubah bila transaksi gagal; unit test men-submit dua checkout paralel terhadap batas satu penggunaan dan membuktikan tepat satu yang berhasil.

Guest approval-to-publication linkage selesai di `091fdf4d26f6cf4b42225297b0576bfbd7890c0d`. Checkout idempotency selesai di `7136d5c6abed881039a5f6764f85c6bc52a63b49`: retry dengan kunci yang sama selama 48 jam mengembalikan order yang sudah ada, tidak mengulang reservasi voucher, dan token order tetap aman untuk respons paralel. Validasi terbaru: 83/83 unit tests, PostgreSQL rules 8/8 emulator tests, typecheck, lint, i18n parity (26 sections), production build, catalog regression, dan checkout retry browser smoke. Rules suite memakai dependency sementara yang cocok dengan Supabase SDK proyek; package/lockfile tidak diubah. Berikutnya durable secure recovery dan trusted rate/abuse controls; proof upload/preview serta Storage rules masih menunggu Supabase Storage. Tahap 9 tetap tertutup.

## Checkpoint Phase 8 — durable guest abuse controls (2026-11-02)
- Rate limiting durable berbasis owner guest selesai untuk GET draft, autosave draft, publish guest, dan checkout guest. Identitas hanya dipakai setelah edit token tervalidasi; tidak ada kepercayaan pada IP header yang dapat dipalsukan.
- Counter di-hash dan disimpan server-only pada `rateLimits/{hash}` dalam transaksi yang sama dengan operasi terlindungi. Client PostgreSQL tidak dapat membaca atau menulis koleksi tersebut.
- Respons rate limit adalah HTTP 429 dengan `Retry-After`; fixed window menggunakan satu dokumen per scope/owner dan reset setelah jendela berakhir.
- Validasi: typecheck lulus, lint lulus, unit test 84/84 lulus, i18n parity 26 section lulus, dan production build lulus dengan 39/39 route. Rules emulator dan PostgreSQL integration test belum dijalankan karena Supabase CLI/dependency emulator tidak ada pada manifest project.
- Tahap 8 belum selesai. Sisa pekerjaan: durable edit-link recovery yang memerlukan provider pengiriman terverifikasi, secure payment-proof upload/preview setelah Supabase Storage disetujui, Storage rules, dan integration/browser/rules closeout tests.


## Checkpoint Phase 8 — secure proof flow and emulator closeout (2026-11-03)
- Added token-authorized guest payment-proof upload at `/api/guest/orders/{orderId}/proof`; files are validated for type/size, written server-side to `paymentProofs/{ownerUid}/{orderId}/...`, and only then transition `awaiting_payment`/`rejected` to `proof_submitted` with audited metadata.
- Added admin-only short-lived signed private preview at `/api/admin/orders/{orderId}/proof` and connected it to the admin review UI. Raw Storage paths remain server-only.
- Added guest payment-detail upload UI with bilingual copy and retry-safe cleanup when metadata commit fails.
- Added Storage Rules coverage, repeatable `test:storage-rules` and `test:integration` scripts, project-local Supabase CLI/Rules Unit Testing dependencies, and explicit dev-editor route wiring.
- Validation: 85 unit tests, typecheck, lint, i18n parity (26 sections), production build, PostgreSQL Rules 8/8, Storage Rules 2/2, PostgreSQL integration 1/1, catalog browser regression, and editor browser regression all pass.
- Phase 8 is not closed yet: production Supabase Storage credentials/bucket and owner-approved production provisioning setup are still absent, and durable edit-link recovery still needs an approved email/WhatsApp provider plus trusted delivery/rate configuration. Phase 9 remains paused.


## Checkpoint Phase 8 — provider-neutral durable recovery foundation (2026-11-03)
- Added `lib/security/recovery.ts` with domain-separated hashed recovery tokens, constant-time verification, destination normalization, and destination hashing.
- Added `lib/server/recovery-services.ts` with transactional one-time records under `guestEditRecoveries/{sha256(token)}`, 30-minute expiry, one-time redemption, edit-token rotation, provider injection, fail-closed behavior when no provider is configured, and destination-scoped durable rate limiting.
- Added `GuestEditRecoveryDoc` model types and explicit server-only PostgreSQL rules. No email/WhatsApp provider is called by the project until an approved adapter is supplied.
- Added unit coverage for no-plaintext destination storage, provider failure behavior, replay denial, token rotation, expiry/rate-limit boundaries, and wrong-destination isolation. Unit suite now passes 88/88 and typecheck/lint pass.
- Remaining external closeout gate: implement/configure an approved email or WhatsApp delivery adapter and expose it through a controlled recovery UI/API; production Storage approval remains separate.


- Added `supabase/migrations/20261103000100_initial_schema.sql` with 16 domain-oriented tables, constraints, indexes, current Basic/Plus/Premium seeds, default-deny RLS for private domain data, narrowly scoped public SELECT policies, and a private `payment-proofs` bucket definition.
- Explicitly preserves the guest-only customer model: `owner_uid` is an opaque synthetic identifier, not an Auth user FK. Public gift rows contain only the published presentation data. No credentials or production data were used.
- Verification run in this checkpoint: `pnpm test:unit` passed 88/88. Temporary `pglast` PostgreSQL parser accepted all 45 SQL statements. Static schema coverage checked all 16 expected domain tables and the private proof bucket.
- Not run / not verified: SQL apply against Supabase/PostgreSQL, RLS tests, Storage access tests, application typecheck/lint/build/browser, database adapter integration, and production cutover. No Supabase project credentials or local PostgreSQL/Supabase service were available.
- Supabase remains the active runtime. This schema checkpoint is not a complete migration. Next: implement server-only Supabase clients and a transactionally correct PostgreSQL Store, then migrate Auth/API/Storage and add database-backed tests before deleting Supabase dependencies.
- Details: `docs/SUPABASE_MIGRATION.md`. Commit SHA and GitHub push status are recorded after the checkpoint commit.


## Supabase migration checkpoint 2 — server client foundation (2026-11-03)

Added Supabase public/server/database environment helpers, request-scoped SSR client, privileged server-only client, and pooled PostgreSQL client factory. Added the Supabase SSR/client and PostgreSQL driver dependencies, documented placeholders in `.env.example` without real credentials, and added env validation tests. The new clients are not yet wired into application runtime; Supabase remains active.

Validation: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check:i18n`, and `pnpm test:unit` (89/89) passed. SQL was not applied to a database; the only Supabase URL/key tests use fake values. No live Supabase credentials were supplied. Next task is the transaction-capable PostgreSQL `Store` adapter and integration tests.


## Supabase migration checkpoint 3 — PostgreSQL Store and PGlite integration (2026-11-03)

Added `lib/server/postgres-store.ts`, an allowlisted mapping between the existing Store paths/domain documents and the normalized schema. It buffers writes until the service callback completes, enforces read-before-write behavior, uses PostgreSQL SERIALIZABLE transactions, and retries serialization/deadlock errors a bounded number of times. Schema compatibility fixes discovered by exercising real service flows include package/payment/voucher/rate-limit schema versions, rate-limit scope, recovery failure time, audit order lookup, and a deferred slug-to-gift FK.

Added PGlite integration tests that apply the migration using stub Supabase `auth`/`storage` schemas, check the anon/authenticated RLS boundary and private bucket declaration, and exercise guest gift creation, rate limiting, checkout/idempotency, voucher cap, proof submission, admin approval, subscription schedule/linkage, and entitlement readback. `pnpm test:supabase` passes 2/2; `pnpm test:unit` passes 89/89; typecheck, lint, build, i18n, and `git diff --check` pass.

The Store is not wired into `getServerEnv()`; Supabase remains active. PGlite uses a compatibility wrapper, so actual `postgres` network-driver/pooler connectivity, production PostgreSQL, transaction races, Supabase Auth cookies, Storage object policies/uploads, route migration, browser/security tests, production data backfill, and cutover remain unverified. See `docs/SUPABASE_MIGRATION.md` for owner configuration needs and the ordered remaining work.

## Admin workspace redesign — 2026-11-03
- Added a dedicated responsive admin shell with sidebar navigation, mobile drawer, active states, account context, and functional logout. Customer header/footer/chat chrome is no longer rendered inside `/admin` routes.
- Redesigned admin login and dashboard overview while preserving Bloomora's existing ivory, paper, ink, moss, rose, and line tokens. Overview metrics are server-backed: transaction count, approved revenue, pending attention, approved payments, published gifts, and recent transactions.
- Added optional payment-method image metadata and a server-only Supabase Storage upload/delete route. Supported images are JPG/PNG/WEBP up to 5 MB; checkout displays the image only when configured and keeps text instructions available.
- Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (89/89), `pnpm build`, and `git diff --check` passed. Build emits only `no-img-element` performance warnings for uploaded payment images.
- Required Supabase setup: apply the migration so the `payment-method-images` public bucket and `payment_methods.image_url/image_path` columns exist. The service-role key remains server-only.

## Checkpoint preview dan payment method — 2026-11-04

Editor preview kini memiliki toggle Mobile/Desktop yang jelas, memakai draft yang sama dan tetap merender melalui `GiftView mode="preview"`; pergantian mode hanya mengubah viewport CSS dan tidak menyimpan atau mengubah status draft. Payment method baru tidak lagi meminta admin mengisi angka Display Order. Jika `sortOrder` tidak dikirim, service menghitung urutan berikutnya secara server-side; saat edit, urutan lama dipertahankan.

Validasi checkpoint: `pnpm typecheck` lulus, `pnpm test:unit` 89/89 lulus, `pnpm check:i18n` lulus (26 section), `pnpm lint` lulus dengan warning existing `<img>`, dan `pnpm build` lulus (40 route). Supabase live dan browser end-to-end belum dijalankan. Pekerjaan berikutnya adalah audit kontrak detail tipe payment method/QRIS dan implementasi template Birthday Party interaktif yang terintegrasi ke engine, editor, preview, dan public renderer.

## Checkpoint typed payment method — 2026-11-04

Payment method sekarang memiliki kontrak terstruktur untuk `bank_transfer`, `e_wallet`, `qris`, dan `other`. Form admin menampilkan field kondisional; service memvalidasi field bank/e-wallet di server, QRIS tidak dipaksa memiliki nomor rekening, dan status QRIS dibedakan dari klaim validitas otomatis. PostgreSQL adapter sudah memetakan kolom baru. Migration SQL additive disiapkan tetapi belum dijalankan ke project Supabase.

Validasi checkpoint: `pnpm typecheck`, `pnpm test:unit` 89/89, dan `pnpm check:i18n` lulus. Commit `85ab3d6` sudah dipush ke `main` dan SHA remote diverifikasi.

## Checkpoint automatic payment method ID — 2026-11-04

Admin tidak lagi mengisi `method id`. Saat membuat metode baru, server membentuk ID stabil dari provider/nama dan menambahkan suffix bila terjadi bentrok. Saat mengedit metode lama, ID internal yang sama tetap dipakai agar checkout, snapshot transaksi, dan audit log tidak berubah.

Validasi: `pnpm typecheck`, `pnpm test:unit` 89/89, `pnpm check:i18n`, dan `git diff --check` lulus.

## Checkpoint performa login dan navigasi admin — 2026-11-04

Optimasi dilakukan pada akar bottleneck: `getCurrentUser` sekarang dideduplikasi per request dengan React cache sehingga layout dan page admin tidak mengulang auth/profile query; login/logout tidak lagi memanggil `router.refresh()` setelah redirect; prefetch seluruh menu admin dimatikan agar dashboard tidak memicu lima request halaman tersembunyi; loading boundary admin ditambahkan untuk feedback instan saat navigasi.

Validasi: typecheck lulus, 89 unit test lulus, lint lulus dengan warning existing `<img>`, dan production build lulus dengan 40 route.

## Hotfix payment method save — 2026-11-04

Memperbaiki bug yang membuat instruksi kosong ditolak walaupun form mendeklarasikannya opsional. Service kini hanya memvalidasi panjang dan karakter kontrol. Jika kolom typed payment method belum tersedia karena migration manual belum dijalankan, service mengembalikan kode `payment_method_schema_outdated` agar penyebab tidak tersamarkan sebagai masalah admin.

Validasi hotfix: typecheck lulus dan 89 unit test lulus.


## Perbaikan save Payment Method dan permission — 2026-11-04

Audit kode menemukan dua gap yang dapat menyebabkan Save ditolak: (1) schema awal tidak memiliki kolom typed-payment yang selalu ditulis adapter; kolom tersebut hanya ditambahkan oleh migration manual `20261104000200_payment_method_details.sql`; dan (2) UI/service/upload membatasi pengguna pada flag `admin`, bukan sekadar sesi Auth valid. Status migration database pengguna tidak dapat diverifikasi dari repo; SQL tidak dijalankan ke project live.

Perbaikan: semua pengguna dengan session Auth server-terverifikasi kini dapat mengelola Payment Method tanpa pemeriksaan role tambahan; sesi kosong tetap ditolak. Ditambahkan `20261104000300_payment_method_authenticated_management.sql` untuk memberi SELECT/INSERT/UPDATE/DELETE tabel payment method hanya kepada `authenticated`, menjaga publik/anon hanya dapat membaca metode aktif, serta membatasi Storage image write/read management pada path UID authenticated. Error schema/RLS/constraint kini dikategorikan dan dicatat di server tanpa mengembalikan detail internal ke client. Upload gambar baru dibersihkan jika save database gagal dan file lama baru dihapus setelah save sukses.

Verifikasi lokal: `pnpm typecheck`, `pnpm test:unit` (91/91), `pnpm test:supabase` (2/2 termasuk policy anon/authenticated/Storage), `pnpm check:i18n`, `pnpm lint`, dan `pnpm build` (40/40 halaman) lulus; lint/build menampilkan warning `<img>` existing pada manager/admin dan checkout. Browser E2E serta Supabase live/Auth/Storage smoke belum dijalankan. Manual SQL dan langkah verifikasi ada di `docs/SUPABASE_MANUAL_SQL.md`.


## Re-investigasi `payment_method_schema_outdated` — 2026-11-04

Pengguna melaporkan telah menjalankan SQL, tetapi Save masih menghasilkan kode tersebut. Workspace ini tidak memiliki `SUPABASE_DB_URL`, public Supabase URL/key, service-role key, atau file env project, jadi database live **tidak dapat diperiksa**. Penyebab yang bisa dipastikan dari kode: handler sebelumnya memetakan *semua* SQLSTATE `42703`, semua `PGRST204`, atau pesan yang hanya menyebut nama kolom typed-payment ke `payment_method_schema_outdated`, tanpa memverifikasi tabel/kolom gagal. Karena Save juga menulis `admin_audit_logs`, kode lama dapat salah menamai kegagalan schema tabel lain.

Handler kini hanya memakai `payment_method_schema_outdated` jika error menyebut kolom kontrak yang dikenal pada tabel `payment_methods`; missing table/kolom audit diberi kode berbeda dan semua error dicatat dengan SQLSTATE/table/column/constraint serta pesan tersanitasi. Ditambahkan test error PostgreSQL yang spesifik vs audit false-positive. File `supabase/diagnostics/diagnose_payment_method_schema.sql` berisi SELECT-only untuk tabel/kolom/tipe/default, constraints, RLS, grant, bucket, policies dan ketersediaan migration history. Tidak dibuat migration perbaikan baru yang spekulatif; hasil diagnosis live dibutuhkan untuk menentukan perbaikan berikutnya.

Langkah berikut: jalankan diagnostic file di Supabase SQL Editor dan kirim semua result grid. Sesudah push code baru, bila error masih muncul gunakan kode terbaru/server log; `payment_method_schema_outdated` kini membuktikan missing expected column pada `payment_methods`, sedangkan error lain akan punya kategori berbeda.

Verifikasi re-diagnosis: `pnpm test:unit` 92/92, `pnpm test:supabase` 2/2 (termasuk menjalankan file diagnosis pada PGlite), typecheck, i18n, lint, dan build 40/40 lulus. Warning lint/build hanya `<img>` existing. PGlite bukan database live.


## Bundle SQL lengkap manual — 2026-11-04

Atas permintaan untuk menjalankan query dari awal sampai terbaru, dibuat `supabase/manual_apply_all_migrations.sql` yang menggabungkan empat migration chronologically. Dalam bundle, dua FK awal dibuat guarded dan empat policy awal menggunakan DROP IF EXISTS; 003 memang mengganti policy Payment Method ke set final. Tidak ada DROP TABLE/COLUMN atau DELETE, seed package menggunakan ON CONFLICT DO NOTHING. Tetap tidak memperbaiki tipe/constraint custom yang tidak diketahui; diagnosis read-only harus diprioritaskan untuk schema noncanonical.

Verifikasi bundle: `pnpm test:supabase` 3/3; test baru menjalankan bundle dua kali, memastikan baris QRIS dan harga paket tidak berubah serta jumlah policy tetap tepat. SQL tidak dijalankan ke Supabase live. Petunjuk pilihan diagnosis vs bundle ada di `docs/SUPABASE_MANUAL_SQL.md`.


## Admin bootstrap pada bundle SQL — 2026-11-04

Bundle lengkap kini memiliki blok opsional `bloomora.admin_email`. Nilai default kosong sehingga tidak memberi hak admin otomatis. Jika email diatur, bundle mencocokkan tepat satu `auth.users` yang sudah ada lalu membuat/memperbarui `public.admin_profiles.role = 'admin'`. Auth account/password tetap harus dibuat melalui Supabase Authentication Dashboard; SQL tidak insert ke `auth.users`.

Jangan menghapus/reset database untuk troubleshooting Save tanpa backup. Full reset akan membuang user Auth, profil, payment methods, orders, gifts, subscriptions, dan data lainnya; bundle hanya membuat schema serta data paket seed. PGlite test memverifikasi opt-in profile hanya untuk user yang dipilih; email/password produksi belum diketahui dan belum dimasukkan ke file.


## Customer flow checkpoint — custom URL at checkout (2026-11-04)

Checkout kini mengizinkan pelanggan menyesuaikan slug sebelum order dibuat. Form menormalisasi slug, menampilkan preview URL, memeriksa availability melalui endpoint server yang mewajibkan edit token dan membatasi laju, lalu submit order membawa `customSlug`. Transaksi membuat reservasi slug baru dan memperbarui slug gift secara atomik dengan order; slug bentrok ditolak dan slug terkunci setelah gift terbit atau order sedang menunggu pembayaran, bukti, atau sudah disetujui. Tes unit memeriksa dua gift yang bersaing dan memastikan hanya satu berhasil.

Schema saat ini sudah memiliki `gifts.slug UNIQUE` dan `slug_reservations.slug PRIMARY KEY`, jadi checkpoint ini tidak memerlukan SQL baru. Reservasi acak awal yang sudah dibuat saat draft tetap ditahan sesuai perilaku lama; pelepasan reservasi otomatis untuk pembatalan/expiry belum dikerjakan. Pembayaran tidak otomatis diverifikasi. Validasi akhir lulus: typecheck, i18n parity (26 section), unit 93/93, PGlite 3/3, lint, dan production build (40 route). Lint/build mengeluarkan warning `<img>` di rendering gambar payment method; tidak ada error. Checkout browser E2E dan Supabase live/concurrency belum dijalankan.


## Customer flow checkpoint — private cross-device Edit URL (2026-11-04)

Ditambahkan route `/edit/{token}` yang hanya memetakan hash token ke gift pada server, memeriksa expiry/deletion dan menerapkan rate limit bagi token valid. Editor menampilkan aksi salin Edit URL beserta peringatan bahwa URL adalah bearer secret. Session token sekarang disimpan per gift dengan fallback untuk sesi lama; route `edit` juga masuk daftar slug terlarang. Adapter PostgreSQL menambahkan mapping `editTokenHash` ke kolom `edit_token_hash`. Tidak ada SQL atau perubahan schema.

Typecheck, 94/94 unit tests, 3/3 PGlite store/schema tests, i18n parity, lint, dan production build (40 static pages) lulus. Browser E2E/live Supabase belum diuji. Token hash-only di database, namun URL edit itu sendiri tetap bearer credential; jangan membagikannya secara publik.


## Customer flow checkpoint — public gift vs. success page (2026-11-04)

Public gift tidak lagi menampilkan QR/copy/share; komponen kontrol publik lama dihapus. Detail order guest yang terautentikasi kini menyediakan aksi copy/open/share public URL dan unduhan QR PNG/SVG hanya ketika order `approved` dan gift benar-benar telah terbit. Edit link ditampilkan terpisah jika token masih tersedia di session per-gift, dengan peringatan bearer. Untuk order approved tetapi belum published, UI meminta owner memeriksa editor dan menerbitkan gift, tanpa menyatakan link publik sudah aktif. Service hanya mengembalikan slug kepada pemegang order access token dan hanya setelah pemeriksaan status publikasi. Tidak ada SQL/schema baru.

Validasi: typecheck, unit 94/94, PGlite 3/3, parity i18n, lint dan production build (40 static pages) lulus. Tidak ada browser E2E (Playwright/esbuild package harness tidak tersedia) atau pengujian Supabase live.

## Customer flow checkpoint — private photo/audio upload (2026-11-04)

Backend dan editor media kini tersambung. Foto/audio disimpan pada bucket privat `gift-media` melalui service-role server only; API memerlukan edit token per gift, memvalidasi entitlement/kuota, MIME dan signature file, membatasi ukuran 25 MiB, serta menyimpan referensi draft dan row `gift_media` dalam transaksi versi optimistis. Gallery dan player memakai signed URL berumur 15 menit; public page hanya menandatangani file yang sudah berada pada published gift. Upload tetap off-by-default hingga `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED=true` disetel pada deployment yang telah menyiapkan bucket/migration/secret.

Verifikasi lokal lulus: `pnpm typecheck`, `pnpm lint`, `pnpm build` (40/40 routes), `pnpm test:unit` (98/98), `pnpm test:supabase` (3/3 PGlite), `pnpm check:i18n` (26 sections), dan `git diff --check`. Lint masih memberi warning `<img>` yang telah ada di payment method/admin/checkout; tidak ada error. PGlite hanya test database lokal yang memakai migration files; SQL tidak dijalankan terhadap Supabase live. Belum dijalankan: Supabase Storage/Auth smoke, browser E2E upload, production deployment, dan konfigurasi env. Migration yang dipakai sudah ada (`20261104000100_customer_media_storage.sql`); tidak ada migration baru pada slice ini.


## Admin/customer transaction checkpoint — soft-delete (2026-11-04)

Admin dengan session terverifikasi dapat menghapus order dari detail admin; pemilik order guest dapat menghapusnya dari detail pesanan hanya dengan order access token tepat. Tidak ada syarat masa aktif habis. Route admin dan owner memproses tombstone secara idempotent; token invalid/cross-order ditolak tanpa mengungkap keberadaan order. `deletedAt/deletedByUid` mempertahankan status pembayaran/review, proof/payment snapshot, voucher usage, gift/public gift, subscription dan approved historical revenue; daftar operasional mengecualikan deleted order. Admin deletion mencatat audit.

Kode membutuhkan migration additive manual `supabase/migrations/20261104000400_order_soft_delete.sql`; migration disertakan di `supabase/manual_apply_all_migrations.sql` sebelum COMMIT. Tidak ada SQL dijalankan ke Supabase live. Verifikasi gabungan: `pnpm typecheck`, `pnpm test:unit` (100/100), `pnpm test:supabase` (3/3 PGlite), `pnpm check:i18n` (26 sections), `pnpm lint`, `pnpm build` (40 routes), dan `git diff --check` lulus. Warning lint hanya `<img>` existing di admin payment-method/checkout. Belum dijalankan: browser E2E serta live Supabase/Auth/SQL smoke.


## Customer checkout UX checkpoint — one required contact channel (2026-11-04)

Form checkout kini mengelompokkan kontak dengan label/placeholder bilingual; pelanggan boleh mengisi email atau WhatsApp saja, dan hanya wajib mengisi minimal salah satu. Error kontak tampil dekat field, email/nomor yang diisi divalidasi di server, serta state form tidak dibuang ketika submit gagal. Backend menyimpan kanal yang tidak diisi sebagai `null`. Kolom contact sudah nullable; tidak ada perubahan schema/SQL. Tes regresi email-only, WhatsApp-only, dan missing contact menolak ada di `guest-order-idempotency.test.ts`.

Setelah perubahan ini: typecheck, unit 101/101, i18n parity 26 sections, lint, production build 40 routes, dan `git diff --check` lulus. `pnpm test:supabase` 3/3 telah lulus pada validasi soft-delete tepat sebelum slice schema-free ini; tidak diulang setelahnya. Supabase live dan browser checkout E2E tidak dijalankan.


## Security checkpoint — payment destinations admin-only (2026-11-05)

Payment method list/detail management and upload/delete of payment destination images now require a verified admin/owner actor, matching the Admin/Owner configuration boundary. Ordinary authenticated accounts cannot modify payment methods or write/read metadata for payment-method images. Database RLS additionally restricts storage objects to admin/owner and the requester's UID folder. Active method read for guest checkout and existing public image delivery are preserved. New additive migration: `20261105000100_payment_method_admin_only.sql`, also included in the consolidated manual SQL bundle.

Validation passed: `pnpm typecheck`, `pnpm test:unit` (101/101), `pnpm test:supabase` (3/3 PGlite including role/path RLS and full bundle replay), `pnpm check:i18n` (26 sections), `pnpm lint`, `pnpm build` (40 routes), and `git diff --check`. Lint reports only existing `<img>` warnings. No Supabase live SQL or credentials used; operator must run migration before deploying this code.


## Customer payment checkpoint — frozen payment details (2026-11-05)

A guest order now freezes method type, provider/account details, instructions and QR image URL/path at checkout. Token-authenticated order detail exposes only safe payment information (not customer contact details). The customer page displays the QR and transfer recipient snapshot, with the already-authoritative discounted `amountIdr` prominently shown as amount due and a bilingual exact-amount instruction for QRIS. Admin updates no longer delete replaced QR images, preserving URLs referenced by existing orders; this currently retains old images indefinitely until reference-counted cleanup exists. JSON snapshot is stored in the existing order JSON column, so no schema migration is required.

Validation passed: typecheck, unit 101/101, i18n 26 sections, lint, production build (40 routes), and `git diff --check`. Lint adds an `<img>` warning for the QR display (existing manager/checkout warnings remain). No PGlite/schema changes, browser E2E, or live payment was tested.


## Checkpoint 2026-11-05: ekspansi katalog Bloomora, batch 1–5

- Registry tunggal sekarang berisi 44 template aktif (4 yang sudah ada + 40 template baru) dalam lima batch. Batch terakhir menambah wedding coastal/city hall, anniversary jarak jauh, birthday milestone, apology saudara, graduation first-generation, friendship archive, dan Lunar New Year. Semua memakai `TemplateConfig`/section builders dan jalur engine tunggal katalog, detail, editor, preview, checkout/publish, serta public gift.
- Menambahkan 7 kelompok kategori baru yang bilingual, mempertahankan kategori lama demi kompatibilitas: Romantic & Love, Birthday & Celebration, Apology & Appreciation, Family & Friendship, Graduation & Achievement, Special Moments, Holiday & Seasonal (Wedding memakai kategori `wedding` yang telah tersedia).
- Menambahkan petal reveal CSS sekali-jalan sebagai opsi tema `flowerTransition` pada 15 desain; tidak memuat library/aset baru dan dinonaktifkan untuk `prefers-reduced-motion`/tema tanpa motion. Featured Demo tetap satu.
- Target minimum 40 template baru sudah terpenuhi (40/40; total 44 template aktif termasuk 4 lama). Browser katalog/mobile tidak dapat dijalankan karena `playwright` tidak terpasang (`Cannot find module 'playwright'`); visual perangkat nyata, checkout nyata, dan Supabase live juga belum dijalankan.
- Validasi kode: `pnpm typecheck`, `pnpm lint` (lulus dengan warning existing `no-img-element` pada komponen payment image), `pnpm test:unit` (102/102), `pnpm check:i18n` (26 section), `pnpm build` (40/40 route), dan `git diff --check` lulus.

## Responsive composition checkpoint — seluruh template (2026-11-05)
Layer responsive baru ditambahkan pada `components/gift/gift.css` untuk renderer bersama seluruh template aktif. Perubahan mempertahankan art direction, urutan section, tipografi, ornamen, animasi dan gallery variant; yang disesuaikan adalah rhythm spacing, tinggi hero/closing, ukuran cover/media, timeline density, card ratio, player, lightbox, touch target, dan layout pada breakpoint 859/520/360px. Art-directed hero/gallery seperti split-photo, fullbleed, type-poster, scrapbook, cinematic, filmstrip, polaroid, collage, masonry, single-feature dan staggered mendapat penyesuaian mobile spesifik, bukan satu mobile layout generik.

`tests/browser/build.mjs` diberi shim `process.env` hanya untuk static browser harness agar `next/image` tidak crash di luar Next runtime; tidak ada dependency atau secret baru di project.

Validasi: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` 103/103, `pnpm build` 40 route, `git diff --check`, dan browser smoke 117/119 checks pass. Desktop, mobile 390px, reduced-motion, preview, gallery/lightbox, audio, partial/empty content, hydration dan horizontal-overflow checks lulus. Dua check SSR fixture lama gagal pada assertion emoji/script yang sudah ada di harness; bukan error responsive/runtime. `test:catalog` tidak dapat start karena hasil `.next` tidak memiliki `BUILD_ID` untuk `next start`; `test:editor` berhenti pada assertion localization existing. Tidak ada data gift pelanggan yang diubah.


## Checkpoint custom slug lifecycle — 2026-11-05

Bug custom slug yang tampil sebagai "Link sudah digunakan" berasal dari model lama: setiap `slug_reservations` dianggap permanen, termasuk reservation draft/testing dan order `awaiting_payment` yang sudah melewati masa hold. Endpoint availability juga hanya membaca reservation tanpa memeriksa gift dan order pemiliknya, sehingga status stale tidak pernah dilepaskan.

Perbaikan memakai aturan server yang sama untuk availability dan checkout. Gift published/archived yang pernah memiliki revision publik, order `approved`, dan order `proof_submitted` tetap memblokir slug. Draft tanpa order aktif, gift yang dihapus sesuai kebijakan, order `cancelled`/`rejected`, serta `awaiting_payment` yang lebih tua dari 48 jam dapat direclaim. Reclaim dilakukan atomik di transaksi yang sama: draft lama dipindah ke generated slug baru, reservation lama dipindah, lalu custom slug diberikan kepada checkout baru. Reservation baru menyimpan `expires_at` dan `order_id`; migration additive tersedia di `supabase/migrations/20261105000100_slug_reservation_lifecycle.sql`.

SQL read-only untuk memeriksa kasus `davidddddaa` ada di `supabase/slug_conflict_report.sql`. Tidak ada pembersihan massal atau penghapusan histori. Regresi baru mencakup reclaim draft stale dan unpaid hold setelah 48 jam. Validasi checkpoint: typecheck lulus, unit test **105/105 lulus**, dan `git diff --check` lulus. Supabase production belum dijalankan dari sandbox; migration harus diterapkan pemilik di SQL Editor sebelum runtime PostgreSQL memakai kolom baru.

## Checkpoint 2026-11-05 — checkout failure diagnosis and voucher UX
- Voucher preview and apply flow implemented with server-owned totals; final order still revalidates and reserves atomically.
- The checkout error was reproduced in SQL: the custom-slug order path writes `slug_reservations.expires_at` and `order_id`, but the integration harness had omitted `20261105000100_slug_reservation_lifecycle.sql`. Load/apply that migration in Supabase before testing checkout.
- Validation after the fix: typecheck passed and Supabase integration passed 3/3.

## Checkpoint 2026-11-06: media guest disiapkan sebelum checkout

Alur editor memperbolehkan guest yang memegang edit-token mengunggah foto/audio sebelum subscription atau pembayaran aktif. Upload tetap server-mediated ke bucket private dengan signed URL dan optimistic version. Autosave/load/publish menerima referensi media private yang dibatasi ke gift yang sama. Limit paket tidak lagi memotong proses editing; checkout server-side menolak paket yang tidak mampu menampung jumlah foto atau musik draft, dan UI menandai paket yang tidak kompatibel beserta alasannya.

Checkpoint ini diverifikasi dengan `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, dan `pnpm test:unit` (105/105). Supabase live, Storage production, dan browser/device smoke belum dijalankan. Commit kode sudah dipush ke `origin/main` sebagai `1ee5ce8`.

## Checkpoint 2026-11-06: Tahap 2 checkout dan proof hardening

Tiga checkpoint Tahap 2 sudah dipush ke `origin/main`: `6143fa7` menyederhanakan pilihan metode pembayaran sebelum order, `c12ede5` menambahkan unduh QRIS asli pada detail order, dan `9bd7e21` menambahkan validasi magic-byte bukti pembayaran. Checkout tidak lagi menampilkan instruksi lengkap sebelum order. Proof upload tetap private dan server-mediated; file palsu dengan MIME yang cocok sekarang ditolak.

Validasi terbaru: `pnpm check:i18n`, `pnpm typecheck`, `pnpm lint`, dan `pnpm test:unit` (106/106) lulus. Sisa yang belum diverifikasi: Storage production/live, browser E2E upload, dan deployment migration pada project Supabase target.

Checkpoint copy proof `c7021dc` sudah dipush ke `origin/main`; pesan id/en kini konsisten dengan route upload bukti privat yang aktif setelah Storage dikonfigurasi.


## Checkpoint 2026-11-06 — guest photo deletion and QRIS display design

Bug hapus foto ditemukan pada `deleteGuestMedia`: transaksi melakukan `tx.update()` pada gift lebih dulu, lalu membaca metadata `giftMedia` dan query reference storage. Adapter PostgreSQL Bloomora memang menolak read-after-write, sehingga route menghasilkan kegagalan tak terduga yang frontend tampilkan sebagai `Connection Error`. Urutan diperbaiki menjadi read metadata/reference terlebih dahulu, validasi ownership tetap dilakukan oleh edit-token, lalu referensi draft dan metadata ditulis. Object Storage hanya dihapus bila tidak dipakai reference aktif lain; public revision tidak disentuh. Regresi unauthorized guest, successful deletion, soft-delete metadata, dan cleanup object ditambahkan.

Admin payment-method page sekarang memiliki pengaturan QRIS terpisah dengan live preview desktop/mobile-friendly: judul, deskripsi, background/accent/border color, frame, dekorasi aman, dan footer. QRIS asli tetap menjadi sumber scan; sistem tidak menggambar ulang modul, tidak menutupinya dengan logo/dekorasi, dan tidak meregangkan atau mengubah payload. Konfigurasi disimpan pada `qris_display_settings/default`, hanya admin yang dapat menyimpan, dan dibaca publik hanya untuk rendering. Saat checkout, konfigurasi dicopy ke `paymentMethodSnapshot`, sehingga perubahan admin berikutnya tidak mengubah order lama. Migration baru: `supabase/migrations/20261106000100_qris_display_settings.sql`; bundle manual juga diperbarui.

Validasi checkpoint: typecheck lulus, lint lulus dengan warning `<img>` existing, regresi media 6/6, order/payment/QRIS 11/11. Supabase live, scan QRIS dengan aplikasi pembayaran, dan browser E2E belum dijalankan dari sandbox; migration harus diterapkan pemilik di project target.


## Checkpoint 2026-11-08: Interactive Flower Adventure

Repository terbaru di-clone dari `origin/main` pada commit `7c8b0fd` sebelum implementasi. Template `interactive-flower-adventure` ditambahkan sebagai konfigurasi engine terpisah: pembuka amplop, surat, memory cards dengan media binding existing, tiga clue cards, flower garden interaktif, closing note, dan PIN 4–6 digit. Template memakai editor generik dan renderer client khusus tanpa mengubah versi template lama.

Validasi aktual setelah `pnpm install --frozen-lockfile`: `pnpm typecheck` PASS; `pnpm test:unit` PASS 134/134; `pnpm check:i18n` PASS (26 bagian); `pnpm lint` PASS dengan warning existing pada `<img>`, satu `exhaustive-deps`, dan deprecation `next lint`; `pnpm build` PASS, 49/49 halaman dibuat. `git diff --check` PASS. Browser catalog/editor smoke belum diuji karena package Playwright tidak tersedia di repository/workspace. Supabase live, Storage production, dan deployment tidak disentuh.

Source checkpoint dipush ke `origin/main` sebagai commit `31e189f`. Risiko residual: PIN/private note saat ini adalah interaction gate client-side, bukan boundary kerahasiaan kriptografis; private content yang dikirim ke browser secara teknis dapat diinspeksi. Untuk privasi kuat, diperlukan verifikasi PIN server-side dan endpoint release note terpisah.
