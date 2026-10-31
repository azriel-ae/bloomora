# Roadmap: tahap yang masih harus dikerjakan

Dibuat 2026-11-01 dari kondisi kode aktual. Baca bersama `docs/DECISIONS.md` (aturan yang tidak boleh dilanggar) dan `docs/HANDOVER.md`.

Penomoran Phase 4 sampai 9 mengikuti urutan prioritas yang ditulis pengguna (katalog, editor, publishing, dashboard, pembayaran dan admin, template). Tahap 10 sampai 12 (Firebase, keamanan, deployment) mengikuti rencana "selesaikan aplikasi dulu, hubungkan Firebase belakangan". Nomor tersebut belum disepakati secara eksplisit; konfirmasi dengan pengguna.

## Aturan untuk semua tahap

- Mulai hanya setelah pengguna menyetujui tahap itu. Kerjakan satu tahap, verifikasi, laporkan, lalu berhenti.
- Jangan menghubungkan Firebase atau mengaktifkan Blaze/billing sebelum Tahap 10 dan persetujuan eksplisit.
- Model B tidak boleh berubah. Semua tulis data lewat `lib/server/services.ts`. Tanpa emoji. Dua bahasa (id dan en) untuk setiap teks baru, lalu `pnpm check:i18n`.
- Jangan klaim PASS untuk pengujian yang tidak dijalankan. Tulis "tidak dijalankan" beserta alasannya.
- Setiap tahap memperbarui `docs/PROGRESS.md`, `docs/CHANGELOG.md`, dan `docs/DECISIONS.md` bila ada keputusan baru.

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
- Foto/audio secara eksplisit nonaktif. Mode tanpa Firebase untuk browser test hanya hidup pada process memory, wajib `NODE_ENV=development` dan `BLOOMORA_DEV_EDITOR=true`, menampilkan peringatan, serta tidak aktif pada production. Tidak memakai localStorage/file.
- `AuthCallout` meneruskan tujuan melalui query `next` yang divalidasi sebagai path internal; middleware locale kini mempertahankan query string pada rewrite.
- Validasi lulus: typecheck/lint dalam production build, 65 unit test, i18n 22 section, `pnpm test:editor` (create/autosave/reload/409/expiry/id-en), dan `pnpm test:catalog`.

Kriteria Phase 5 terpenuhi. Firebase belum terhubung; alur autentikasi/draft terhadap Firebase nyata, emulator rules, media, publishing, serta halaman publik tidak diklaim sudah diuji/dibangun di Phase ini. Phase 6 belum dimulai; tunggu persetujuan eksplisit pengguna.

## Phase 6: publishing dan halaman publik

**Status: SELESAI dan diverifikasi pada 2026-11-01.**

Kerjakan:
- `/g/[slug]`: server component membaca `publicGifts/{slug}` (Admin SDK), memilih template lewat `getTemplateForRender(templateId, templateVersion)`, merender `GiftView mode="public"` tanpa `fillEmptyFrom`. Validasi slug dengan `isValidSlug`. Public read hanya membaca satu dokumen public dan tidak memuat entitlement.
- Keadaan: terbit, diarsipkan, dihapus/dicabut, slug tidak valid atau tidak ditemukan; metadata Open Graph; `noindex` bila perlu; layar tanpa header situs (perluas `ChromeGate` untuk `/g/`; ubah `/g/demo` lama dengan hati-hati agar tidak merusak rute lama).
- Dialog konfirmasi publish (publikasikan persis versi yang dipratinjau), salin link, `navigator.share` bila ada, kode QR (`qrcode.react` sudah menjadi dependency).
- Model B: halaman publik tidak boleh membaca subscription sama sekali. Tambahkan tes yang membuktikannya.
- Audio: selesaikan `audioSrc` dari media publik; selama media nonaktif, bagian musik tidak muncul.
- Tulis ulang teks yang masih menyiratkan gift kedaluwarsa (FAQ, `/expiration`, teks penerima, `plan.md`) agar sesuai Model B, dalam dua bahasa.

Hasil: halaman publik terhubung ke service public-read, state terbit/arsip/cabut/tidak ditemukan dilokalkan, metadata diberi `noindex` untuk state nonpublik, chrome situs disembunyikan pada `/g/`, dan kontrol publish/share/QR tersedia. Unit test membuktikan gift tetap tampil setelah paket pemilik tidak lagi memiliki subscription. Regression browser katalog/editor lulus dengan Playwright/Chromium sementara di luar manifest; browser test public dengan Firebase/fixture server belum dijalankan karena Firebase belum dikonfigurasi.

## Phase 7: Analytics, Insights & Export

**Status: IMPLEMENTASI INTI SELESAI; verifikasi build/browser dan closeout dokumentasi masih berjalan.**

Implementasi inti:
- `getDashboardData` membaca gift, subscription, dan order milik user melalui service server; dashboard menampilkan total, draf, terbit, arsip, pending order, paket, expiry, dan gift cards tanpa angka hardcoded.
- `giftAnalytics/{slug}` menyimpan aggregate `totalViews`, `firstViewedAt`, `lastViewedAt`, dan `viewsByDay` tanpa identitas visitor. Public page hanya mencatat view untuk gift yang benar-benar published; tidak ada subscription read pada jalur publik.
- Insight mencakup publication rate, total public views, dan gift paling dilihat. `GET /api/dashboard/export?format=json|csv` mengekspor data gift milik user saja melalui session server.
- Dashboard menjelaskan state belum terhubung Firebase secara jujur; tidak memakai localStorage/file sebagai database.

## Phase 8: bukti bayar dan verifikasi admin

Kondisi sekarang: `createOrder`, `approveOrder`, `rejectOrder`, audit log, route `/api/orders` dan `/api/admin/orders/[orderId]` ada. Belum ada: pengajuan bukti (`awaiting_payment` ke `proof_submitted`), halaman QRIS interaktif, daftar order untuk admin, UI admin (`app/admin/[section]/page.tsx` masih statis).

KEPUTUSAN DIPERLUKAN: bukti bayar adalah file dan Storage belum ada. Opsi (a) tunggu Storage (Tahap 10); (b) simpan bukti kecil terkompresi di subkoleksi Firestore privat. Pengguna sudah memutuskan menunda sampai Storage siap, jadi bangun semuanya KECUALI unggahan bukti, atau minta persetujuan baru untuk (b).

Kerjakan: service `submitProof` (transisi dengan `canTransitionOrder`), halaman pembayaran QRIS, daftar order dan aksi setujui/tolak untuk admin (verifikasi klaim admin di server), tampilan subscription aktif dan kedaluwarsa untuk admin, dan DIVERGENSI stacking jika sudah diputuskan. Jangan simulasikan pembayaran berhasil. Subscription hanya lahir dari `approveOrder`. Tidak ada klien yang bisa mengubah status order atau subscription.

Bagian admin lain dari brief awal (sesuaikan cakupan dengan pengguna): kelola template (aktif/nonaktif, featured, tanpa merusak gift terbit), kelola paket, gift terbit, laporan konten, moderasi (pencabutan = `publicGifts.status = 'removed'`).

## Phase 9: template sampai 43

Brief awal: minimal 43 desain yang benar-benar berbeda; kualitas lebih penting daripada angka. Target per kategori: Birthday 6, Anniversary 6, Friendship 5, Graduation 5, Thank You 4, Long Distance 4, Appreciation 4, Just Because 3, Wedding 3, Family 3. Ada 4 template sekarang.

Aturan: tambahkan konfigurasi di `lib/engine/templates/` memakai builder, daftarkan di `ALL_TEMPLATE_VERSIONS`, dan wajib lulus `validateTemplateConfig` (gerbang kualitas). Template berbeda harus berbeda dalam varian section, tema, tipografi, dan alur, bukan sekadar warna. Varian yang belum diimplementasikan renderer (daftar di `lib/engine/theme-vars.ts`, `IMPLEMENTED_VARIANTS`) harus dibangun lebih dulu (komponen + CSS + tes browser). Hanya satu Featured Demo, kecuali pengguna mengubah keputusan.

## Tahap 10: integrasi Firebase (setelah aplikasi selesai dan ada persetujuan)

1. Env vars (lihat README) dan akun layanan dengan izin minimal. Jangan menaruh kredensial di repo.
2. Deploy `firebase/firestore.rules` dan `firestore.indexes.json`; seed koleksi `packages` dari `lib/packages.ts`; pastikan harga dan durasi mengikuti catatan di `DECISIONS.md` (#18).
3. Verifikasi `lib/server/firestore-store.ts` terhadap emulator (adapter belum pernah dijalankan dengan SDK asli) dan kompilasi dengan tipe Firebase asli.
4. Ganti sumber paket di `pricing-page` (hardcoded) dan di band katalog (seed) agar membaca koleksi `packages`.
5. Terapkan planner migrasi (`lib/model/migrate.ts`) lewat skrip dengan mode dry-run default; tidak ada migrasi destruktif.
6. Setelah persetujuan Blaze: Storage, unggahan yang dikeluarkan server (tipe, ukuran, jumlah, entitlement), salin media ke `public/gifts/{slug}/{revisi}/` saat publish, bukti bayar privat, lalu ubah `MEDIA_UPLOAD_ENABLED` dalam commit yang sama.

## Tahap 11: uji keamanan

`pnpm test:rules` di emulator (tambahkan `@firebase/rules-unit-testing` dan `firebase-tools` ke devDependencies, perbarui lockfile); tes Storage rules; uji bahwa pengguna tidak bisa mengubah subscription, menyetujui pembayaran, mengubah peran admin, mengedit gift orang lain, atau membaca bukti bayar orang lain; tes lintas pengguna; tinjau cookie sesi dan pengecekan origin; tinjau batas laju.

## Tahap 12: deployment

Kompatibilitas Vercel (tanpa penyimpanan lokal, tanpa localhost hardcode, inisialisasi Admin SDK server-only, cache hanya untuk data publik), `pnpm build`, pengujian integrasi produksi yang dibedakan jelas dari uji lokal. Jangan deploy produksi atau ubah billing tanpa persetujuan.

## Daftar keputusan yang masih menunggu pengguna

1. Stacking perpanjangan: kode belum menumpuk (DECISIONS divergensi 1).
2. Batas gift per subscription: `maxGifts: 1` hanya asumsi (divergensi 2).
3. Penomoran tahap 4 sampai 12 di atas.
4. Penyimpanan bukti bayar sebelum Storage (Phase 8).
5. Cakupan fitur admin (Phase 8).
6. Font: tetap system stack atau `next/font`.
7. Emoji bendera pada header lama (`components/language-switcher.tsx`) belum diubah; di luar desain baru, tanyakan apakah ingin diganti.
