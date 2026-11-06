# Roadmap: tahap yang masih harus dikerjakan

Dibuat 2026-11-01 dari kondisi kode aktual. Baca bersama `docs/DECISIONS.md` (aturan yang tidak boleh dilanggar) dan `docs/HANDOVER.md`.

Penomoran Phase 4 sampai 9 mengikuti urutan prioritas yang ditulis pengguna (katalog, editor, publishing, dashboard, pembayaran dan admin, template). Tahap 10 sampai 12 (Supabase, keamanan, deployment) mengikuti rencana "selesaikan aplikasi dulu, hubungkan Supabase belakangan". Nomor tersebut belum disepakati secara eksplisit; konfirmasi dengan pengguna.

## Aturan untuk semua tahap

- Mulai hanya setelah pengguna menyetujui tahap itu. Kerjakan satu tahap, verifikasi, laporkan, lalu berhenti.
- Jangan menghubungkan Supabase atau mengaktifkan Supabase Storage provisioning sebelum Tahap 10 dan persetujuan eksplisit.
- Model B tidak boleh berubah. Semua tulis data lewat `lib/server/services.ts`. Tanpa emoji. Antarmuka produk hanya Bahasa Indonesia; teks UI baru ditambahkan pada `messages/id.json` dan diverifikasi dengan `pnpm check:i18n`.
- Jangan klaim PASS untuk pengujian yang tidak dijalankan. Tulis "tidak dijalankan" beserta alasannya.
- Setiap tahap memperbarui `docs/PROGRESS.md`, `docs/CHANGELOG.md`, dan `docs/DECISIONS.md` bila ada keputusan baru.

## Maintenance 2026-11-06: locale, domain, dan chatbot

**Status implementasi: selesai; pengujian continuation dan push dicatat setelah dijalankan.** UI kini hanya Bahasa Indonesia; prefiks `/id` dan `/en` menjadi redirect kompatibilitas ke route tanpa prefix, dan cookie locale legacy dibersihkan. Metadata, robots/sitemap, serta tautan publik diarahkan ke `https://bloomora.my.id`. Chatbot memberi bunyi ringan hanya setelah balasan sukses selesai dan suara diaktifkan pengguna.

**Tindakan deployment tersisa:** inspeksi read-only Vercel pada 2026-11-06 menemukan `NEXT_PUBLIC_SITE_URL` belum disetel. Domain apex berstatus valid tetapi Vercel mengarahkannya dengan 308 ke `www.bloomora.my.id`; `www` saat ini ditetapkan ke Production. Untuk memenuhi canonical apex yang diminta, set `NEXT_PUBLIC_SITE_URL=https://bloomora.my.id` pada Production, arahkan apex ke deployment Production dan redirect `www` ke apex, lalu verifikasi ulang domain/DNS. Tidak ada pengaturan Vercel yang diubah dalam task ini; jangan mengklaim konfigurasi live sesuai canonical sampai tindakan tersebut selesai.

## Tahap 0: sebelum Phase 4

Verifikasi Phase 3 di mesin yang punya dependency: `pnpm install && pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit && pnpm check:i18n`, lalu buka `/demo/chapter-of-us`, `/templates`, `/create?template=chapter-of-us` (id dan en, desktop dan mobile) dan periksa console. Perbaiki error, lalu koreksi status Phase 3 di `PROGRESS.md`. Selesaikan dua divergensi di `DECISIONS.md` (stacking perpanjangan, kuota gift) atau catat sebagai ditunda.

## Phase 4: katalog dan detail template

**Status: SELESAI dan diverifikasi pada 2026-11-01.** Pengguna menyetujui Phase 4 pada 2026-11-01. Kondisi awal dan daftar cakupan di bawah dipertahankan sebagai rekam jejak persyaratan.

Hasil pelaksanaan:
- Semua konsumen UI yang tersisa (`templates-page`, kartu, detail, create, homepage, editor preview, fallback `/g/demo`, dan konteks chatbot) kini membaca template dari engine aktif. `lib/templates.ts`, `tests/unit/legacy-registry.test.ts`, dan namespace pesan per-slug yang usang dihapus; tidak ada referensi kode aktif yang tertinggal.
- Pencarian dan filter kategori memakai `searchCatalog`/`CATEGORIES`; state kosong/reset, route loading dan error, serta badge featured/popular/new tersedia dalam dua bahasa.
- Demo link hanya muncul untuk template yang `hasDemo`; CTA gunakan template mempertahankan slug terpilih dan mengarahkan ke alur akun yang ada. Tidak ada demo palsu.
- Detail dirender per template dari nama, kategori, deskripsi, section, palet, varian, dan sample data. Eligibilitas paket dihitung dari `DEFAULT_PACKAGES`/`allowedTemplateTiers`, ditampilkan sebagai informasi saja dan bukan pemeriksaan akun.
- Browser test menemukan prefiks `/en/...` sempat merender locale dari cookie lama pada request pertama. Middleware kini menetapkan cookie locale pada request yang dirender sekaligus pada response.
- Validasi lulus: 62 unit test, i18n 22 section, 119/119 browser test Phase 3, browser test katalog termasuk filter/detail/eligibilitas/locale/homepage/create/editor/mobile, typecheck, lint, dan production build.

Kriteria selesai terpenuhi: semua halaman terkait memakai engine, tidak ada referensi aktif ke `lib/templates.ts`, tes unit/browser dan `pnpm check:i18n` hijau. Phase 5 selesai dan menunggu persetujuan eksplisit untuk Phase 6.

## Phase 5: editor dan penyimpanan draft

**Status: SELESAI dan diverifikasi pada 2026-11-01.** Pengguna menyetujui Phase 5 pada 2026-11-01. Kondisi awal dan daftar cakupan dipertahankan di sini sebagai rekam jejak.

Hasil pelaksanaan:
- `components/gift-editor.tsx` membangkitkan field/list dari `TemplateConfig`, toggle hanya untuk section opsional, dan mempratinjau melalui `GiftView mode="preview"`; sample hanya mengisi tampilan, bukan isi yang disimpan.
- Draft dibuat lewat `POST /api/gifts`, dibaca privat lewat `GET /api/gifts/[giftId]`, lalu disimpan lewat `PUT` menggunakan service transaksional dan `expectedVersion`. Route baru `/editor/new?template=...` dan `/editor/g/[giftId]` memisahkan ID gift dari slug template; route lama mempertahankan kompatibilitas dengan redirect.
- Autosave debounce, status nyata, `beforeunload`, retry untuk error sementara, dan konflik `409` dengan rekonsiliasi eksplisit (tidak pernah retry konflik memakai versi tebakan).
- GET privat hanya mengembalikan draft kepada pemilik; setelah paket habis draft tetap bisa dibaca tetapi read-only, konten lokal tidak dibuang, dan CTA paket tersedia.
- Foto/audio secara eksplisit nonaktif. Mode tanpa Supabase untuk browser test hanya hidup pada process memory, wajib `NODE_ENV=development` dan `BLOOMORA_DEV_EDITOR=true`, menampilkan peringatan, serta tidak aktif pada production. Tidak memakai localStorage/file.
- `AuthCallout` meneruskan tujuan melalui query `next` yang divalidasi sebagai path internal; middleware locale kini mempertahankan query string pada rewrite.
- Validasi lulus: typecheck/lint dalam production build, 65 unit test, i18n 22 section, `pnpm test:editor` (create/autosave/reload/409/expiry/id-en), dan `pnpm test:catalog`.

Kriteria Phase 5 terpenuhi. Supabase belum terhubung; alur autentikasi/draft terhadap Supabase nyata, emulator rules, media, publishing, serta halaman publik tidak diklaim sudah diuji/dibangun di Phase ini. Phase 6 belum dimulai; tunggu persetujuan eksplisit pengguna.

## Phase 6: publishing dan halaman publik

**Status: SELESAI dan diverifikasi pada 2026-11-01.**

Kerjakan:
- `/g/[slug]`: server component membaca `publicGifts/{slug}` (Admin SDK), memilih template lewat `getTemplateForRender(templateId, templateVersion)`, merender `GiftView mode="public"` tanpa `fillEmptyFrom`. Validasi slug dengan `isValidSlug`. Public read hanya membaca satu dokumen public dan tidak memuat entitlement.
- Keadaan: terbit, diarsipkan, dihapus/dicabut, slug tidak valid atau tidak ditemukan; metadata Open Graph; `noindex` bila perlu; layar tanpa header situs (perluas `ChromeGate` untuk `/g/`; ubah `/g/demo` lama dengan hati-hati agar tidak merusak rute lama).
- Dialog konfirmasi publish (publikasikan persis versi yang dipratinjau), salin link, `navigator.share` bila ada, kode QR (`qrcode.react` sudah menjadi dependency).
- Model B: halaman publik tidak boleh membaca subscription sama sekali. Tambahkan tes yang membuktikannya.
- Audio: selesaikan `audioSrc` dari media publik; selama media nonaktif, bagian musik tidak muncul.
- Tulis ulang teks yang masih menyiratkan gift kedaluwarsa (FAQ, `/expiration`, teks penerima, `plan.md`) agar sesuai Model B, dalam dua bahasa.

Hasil: halaman publik terhubung ke service public-read, state terbit/arsip/cabut/tidak ditemukan dilokalkan, metadata diberi `noindex` untuk state nonpublik, chrome situs disembunyikan pada `/g/`, dan kontrol publish/share/QR tersedia. Unit test membuktikan gift tetap tampil setelah paket pemilik tidak lagi memiliki subscription. Regression browser katalog/editor lulus dengan Playwright/Chromium sementara di luar manifest; browser test public dengan Supabase/fixture server belum dijalankan karena Supabase belum dikonfigurasi.

## Phase 7: Analytics, Insights & Export

**Status: IMPLEMENTASI INTI SELESAI; verifikasi build/browser dan closeout dokumentasi masih berjalan.**

Implementasi inti:
- `getDashboardData` membaca gift, subscription, dan order milik user melalui service server; dashboard menampilkan total, draf, terbit, arsip, pending order, paket, expiry, dan gift cards tanpa angka hardcoded.
- `giftAnalytics/{slug}` menyimpan aggregate `totalViews`, `firstViewedAt`, `lastViewedAt`, dan `viewsByDay` tanpa identitas visitor. Public page hanya mencatat view untuk gift yang benar-benar published; tidak ada subscription read pada jalur publik.
- Insight mencakup publication rate, total public views, dan gift paling dilihat. `GET /api/dashboard/export?format=json|csv` mengekspor data gift milik user saja melalui session server.
- Dashboard menjelaskan state belum terhubung Supabase secara jujur; tidak memakai localStorage/file sebagai database.

## Phase 8: bukti bayar dan verifikasi admin

Kondisi sekarang: checkout guest, CRUD payment/package/voucher, atomic reservation, secure guest order detail, admin detail/audit/proof gates, dan subscription stacking transactionally sudah ada. Belum ada: secure proof upload + preview (`awaiting_payment` ke `proof_submitted`, Storage blocker), approval-to-gift publication, secure recovery, abuse controls, serta emulator/rules/integration tests.

Keputusan yang sudah dibuat: upload bukti adalah file dan ditunda sampai Supabase Storage siap; jangan beralih ke penyimpanan bukti PostgreSQL tanpa persetujuan baru. Lanjutkan semua pekerjaan lain yang tidak membutuhkan Storage. Jangan mengaktifkan Supabase Storage production/billing tanpa persetujuan eksplisit.

Urutan pengerjaan lanjut: durable secure recovery, trusted rate/abuse controls, dan tests yang tidak memerlukan Storage. Guest order idempotency kini melindungi retry selama 48 jam tanpa reservasi voucher/order ganda. Guest order → approved subscription → gift publication linkage telah diimplementasikan: approval mengaitkan draft dengan subscription, dan pelanggan menerbitkan secara eksplisit memakai edit token setelah slot subscription aktif. Setelah Storage tersedia, lakukan secure proof submission dan private preview. Jangan simulasikan pembayaran berhasil. `approveOrder` hanya menerima proof metadata server-validated. Tidak ada klien yang bisa mengubah status order atau subscription.

Bagian admin lain dari brief awal (sesuaikan cakupan dengan pengguna): kelola template (aktif/nonaktif, featured, tanpa merusak gift terbit), kelola paket, gift terbit, laporan konten, moderasi (pencabutan = `publicGifts.status = 'removed'`).

## Phase 9: template sampai 43

Brief awal: minimal 43 desain yang benar-benar berbeda; kualitas lebih penting daripada angka. Target per kategori: Birthday 6, Anniversary 6, Friendship 5, Graduation 5, Thank You 4, Long Distance 4, Appreciation 4, Just Because 3, Wedding 3, Family 3. Ada 4 template sekarang.

Aturan: tambahkan konfigurasi di `lib/engine/templates/` memakai builder, daftarkan di `ALL_TEMPLATE_VERSIONS`, dan wajib lulus `validateTemplateConfig` (gerbang kualitas). Template berbeda harus berbeda dalam varian section, tema, tipografi, dan alur, bukan sekadar warna. Varian yang belum diimplementasikan renderer (daftar di `lib/engine/theme-vars.ts`, `IMPLEMENTED_VARIANTS`) harus dibangun lebih dulu (komponen + CSS + tes browser). Hanya satu Featured Demo, kecuali pengguna mengubah keputusan.

## Tahap 10: integrasi Supabase (setelah aplikasi selesai dan ada persetujuan)

1. Env vars (lihat README) dan akun layanan dengan izin minimal. Jangan menaruh kredensial di repo.
2. Deploy `supabase/postgres.rules` dan `postgres.indexes.json`; seed koleksi `packages` dari `lib/packages.ts`; pastikan harga dan durasi mengikuti catatan di `DECISIONS.md` (#18).
3. Verifikasi `lib/server/postgres-store.ts` terhadap emulator (adapter belum pernah dijalankan dengan SDK asli) dan kompilasi dengan tipe Supabase asli.
4. Pricing, band katalog, detail template, checkout, dan order server telah memakai daftar paket aktif dari service `packages`; pada integrasi Supabase, verifikasi hasil baca PostgreSQL dan seed koleksi ini dari `lib/packages.ts`.
5. Terapkan planner migrasi (`lib/model/migrate.ts`) lewat skrip dengan mode dry-run default; tidak ada migrasi destruktif.
6. Setelah persetujuan production provisioning: Storage, unggahan yang dikeluarkan server (tipe, ukuran, jumlah, entitlement), salin media ke `public/gifts/{slug}/{revisi}/` saat publish, bukti bayar privat, lalu ubah `MEDIA_UPLOAD_ENABLED` dalam commit yang sama.

## Tahap 11: uji keamanan

`pnpm test:rules` di emulator (tambahkan `@supabase/rules-unit-testing` dan `supabase-tools` ke devDependencies, perbarui lockfile); tes Storage rules; uji bahwa pengguna tidak bisa mengubah subscription, menyetujui pembayaran, mengubah peran admin, mengedit gift orang lain, atau membaca bukti bayar orang lain; tes lintas pengguna; tinjau cookie sesi dan pengecekan origin; tinjau batas laju.

## Tahap 12: deployment

Kompatibilitas Vercel (tanpa penyimpanan lokal, tanpa localhost hardcode, inisialisasi Admin SDK server-only, cache hanya untuk data publik), `pnpm build`, pengujian integrasi produksi yang dibedakan jelas dari uji lokal. Jangan deploy produksi atau ubah billing tanpa persetujuan.

## Daftar keputusan yang masih menunggu pengguna

1. Pengaturan Storage proof submission dan secure file preview tetap menunggu owner (Phase 8).
2. Batas gift per subscription: `maxGifts: 1` hanya asumsi (divergensi 2).
3. Penomoran tahap 4 sampai 12 di atas.
4. Penyimpanan bukti bayar sebelum Storage (Phase 8).
5. Cakupan fitur admin (Phase 8).
6. Font: tetap system stack atau `next/font`.
7. Emoji bendera pada header lama (`components/language-switcher.tsx`) belum diubah; di luar desain baru, tanyakan apakah ingin diganti.


## Phase 8 checkpoint update — 2026-11-02

Completed the account-free checkout and admin sales foundation: guest order creation, server-side package/voucher pricing, contact capture, transaction storage, admin transaction API/sales page, payment-method/package/voucher administration, atomic voucher reservation, 48-hour guest-order idempotency, secure per-order payment detail/instructions, admin order detail/audit with proof-gated actions, subscription stacking, and guest order-to-gift publication linkage. Remaining Phase 8 work is secure proof submission/preview after Storage is available, durable secure recovery, trusted abuse/rate controls, Storage rules, and integration tests. PostgreSQL rules suite passes 8/8 in the emulator using temporary dependencies matching the project SDK; the project-local rules tooling remains absent and PostgreSQL adapter integration is not run. Phase 9 must remain paused until the Phase 8 closeout gate passes.


## Phase 8 closeout gate — wajib sebelum dinyatakan selesai

Phase 8 belum selesai. Closeout hanya boleh dilakukan setelah semua hal berikut tersedia dan diuji: admin CRUD package/payment-method/voucher; server-side voucher usage reservation; order payment instructions; secure payment-proof submission; `awaiting_payment -> proof_submitted -> approved/rejected` transitions; admin order detail and verification UI; idempotent subscription activation; stacking behavior sesuai keputusan; guest order-to-gift publication linkage; cross-customer isolation; rate limiting/idempotency; unit, integration, browser, dan rules tests. Supabase Storage dependency harus dijelaskan secara eksplisit bila masih menjadi blocker.


### Checkpoint Phase 8 idempotent guest checkout — 2026-11-02

Latest code checkpoint `7136d5c6abed881039a5f6764f85c6bc52a63b49` requires a random guest idempotency key and stores only its owner-scoped hash for a 48-hour replay window. Concurrent/retried requests return the same order, do not reserve a voucher twice, and reissue order access using a bounded hashed-token history. Validation: typecheck, lint, 83 unit tests, i18n parity (26 sections), production build, catalog regression, simulated-network-failure checkout browser smoke, and PostgreSQL rules emulator suite (8/8) passed. Emulator rules testing used temporary CLI/test dependencies matching Supabase SDK 11.10.0; repo manifest/lockfile were not changed. Secure proof upload/private preview still require owner-approved Storage setup; secure recovery, trusted rate/abuse controls, Storage rules, and integration tests remain. Phase 8 is not complete; Phase 9 stays paused.


## Phase 8 checkpoint update — secure proof flow (2026-11-03)

Secure proof upload and private admin preview are implemented behind Supabase Admin Storage configuration. The guest token-authenticated route validates file type/size, uses owner/order-scoped private paths, commits metadata transactionally, and cleans up failed uploads; Storage Rules and PostgreSQL integration/rules suites now run from project scripts. The remaining closeout blockers are external: production Supabase Storage bucket/production provisioning approval and a real approved email/WhatsApp provider for durable edit-link recovery. Phase 9 remains paused until those are configured and non-production smoke tests pass.


## Current authorized work: full Supabase migration (2026-11-03)

This user-authorized migration supersedes the old Phase 10 Supabase-integration target above. Historical phase notes remain for context, but the target backend is Supabase only; Supabase remains active solely until a tested replacement and cutover exist.

1. **Schema foundation — migration and PGlite checks complete; real Supabase remains pending.** `pnpm test:supabase` applies the migration in PGlite, checks seeds/private bucket and client RLS boundaries. Actual Supabase migration application, Storage-object policy behavior, and deployment configuration still need an owner project.
2. **Runtime and transaction layer — clients and Store adapter implemented, not wired.** `postgresStore()` uses serializable SQL transactions and bounded serialization/deadlock retries; PGlite exercises guest checkout, idempotency, voucher usage, proof submission, approval, subscription linkage, and entitlement reads. Validate with the production `postgres` driver and actual PostgreSQL/Supabase, including race/concurrency tests, before changing runtime.
3. **Admin-only authentication.** Disable public signup, provision owner/admin out of band, move server-verified sessions/role checks to Supabase Auth, remove customer signup/login UI and keep guests account-free.
4. **API and Storage migration.** Migrate all services/routes, private proof upload/preview, recovery records, and abuse controls; public gift reads must remain presentation-only and all payment proofs private.
5. **Verification and cutover.** Add database, RLS, Storage, authorization, concurrency and browser tests. Backfill only if actual Supabase production data exists and the owner authorizes it. Do not remove Supabase packages/rules or claim completion until every production path has tested Supabase parity and a rollback plan.
6. **Configuration/documentation.** Replace active Supabase environment, README and deployment guidance with Supabase instructions; never commit real credentials. Update `docs/SUPABASE_MIGRATION.md`, progress, decisions and handover at each checkpoint.

Current verified progress: unit tests 89/89 pass; PGlite schema/RLS/Store integration tests 2/2 pass; SQL parses and applies in the test engine. The Store/client factories remain unwired, Supabase is active, and live PostgreSQL/Supabase/Auth/Storage/browser/concurrency/cutover testing is pending. Exact owner configuration needs and remaining tasks are in `docs/SUPABASE_MIGRATION.md`.


## Checkpoint transaction management — 2026-11-04

Order dapat di-soft-delete oleh admin terautentikasi dari detail admin atau oleh pemilik guest dengan order access token valid, tanpa bergantung pada expiry. Ini tidak membatalkan pembayaran/gift/subscription dan tidak menghapus accounting history; action admin diaudit dan daftar operasi mengecualikan tombstone. Kode, unit/PGlite coverage, dan confirmation UI tersedia. Masih dibutuhkan penerapan manual migration `20261104000400_order_soft_delete.sql`, Supabase live auth/schema smoke, dan browser E2E sebelum menyatakan production end-to-end tervalidasi. Customer authentication tetap tidak diperkenalkan.


## Checkpoint checkout form UX — 2026-11-04

Field transaksi dikurangi: minimal salah satu dari email atau WhatsApp wajib, bukan keduanya. Input kontak dikelompokkan, label bilingual menandai opsional, placeholder membantu, dan validasi server menolak format yang tidak valid. Regression test mencakup email-only, WhatsApp-only, dan tanpa kontak. Tidak ada SQL. Full browser E2E serta Supabase live tetap belum tersedia.


## Update Phase 9 — target ekspansi katalog pengguna (2026-11-05)

Target terbaru dari brief pengguna menggantikan hitungan historis target 43 lama: sekurangnya 40 template BARU di luar template yang tersedia, mencakup Romantic & Love, Wedding Invitation, Birthday & Celebration, Apology & Appreciation, Family & Friendship, Graduation & Achievement, Special Moments, dan Holiday & Seasonal. Kategori lama tetap kompatibel. Target 40 template baru sudah tercapai melalui engine yang ada; katalog memiliki 44 template aktif (termasuk 4 existing).

Batch 1–5 menambah 40 konfigurasi bilingual pada registry yang sama, termasuk delapan gaya wedding (garden, floral, luxury, minimal, tradisional, intimate, coastal destination, dan city hall), serta anniversary, apology, friendship, family milestones, perayaan, dan hari raya. Featured Demo tetap satu. Petal reveal ringan dan opt-in pada 15 tema serta tunduk pada reduced motion. Typecheck, lint, 102 unit tests, i18n, production build (40 routes), dan diff check lulus. Browser/visual mobile belum diuji karena Playwright tidak tersedia di environment ini.

Lanjutkan per batch yang bisa diuji dan dipush mandiri. Jangan memenuhi kuota melalui variasi warna/judul saja. Bila butuh layout/section variant baru, implementasikan di renderer bersama, tambahkan tes browser, dan jaga pinned `templateVersion` agar gift lama tidak berubah. Tidak ada target checkpoint ini yang mengizinkan perubahan ke data customer, konfigurasi Supabase production, atau pembayaran.
