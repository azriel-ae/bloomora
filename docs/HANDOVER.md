# Handover Bloomora (untuk AI atau developer baru)

Baca dulu `docs/SUPABASE_MIGRATION.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, dan `docs/ROADMAP.md`. Checkpoint terbaru diperbarui dari kode aktual per 2026-11-06; catatan Phase sebelumnya di bawah adalah riwayat dan tidak mengalahkan checkpoint ini.

Checkpoint 2026-11-07 menegaskan alur guest media: edit-token yang valid cukup untuk upload foto/audio ke bucket privat sebelum checkout. Upload memiliki validasi signature/type/size, signed URL, rate limit, batas sementara abuse, dan cleanup object saat commit draft gagal. Batas paket tidak dipakai untuk menolak eksperimen di editor; server memeriksa jumlah foto dan musik terhadap konfigurasi paket saat checkout. Storage live, RLS production, dan deployment env tetap belum diuji pada koneksi Supabase nyata.

Continuation 2026-11-06 mempertahankan UI Indonesia-only/domain/chat, lalu menambahkan upload QRIS yang hanya mengaktifkan crop yang tervalidasi (auto + manual fallback), renderer QRIS bersama admin/customer, desain beku per order, unduhan PNG final, dan endpoint gambar ber-token. Cleanup menghapus `components/publish-dialog.tsx`, `lib/brand.ts`, `react-hook-form`, dan `@hookform/resolvers` setelah dipastikan tidak dirujuk; `@zxing/library` tinggal sebagai dev fixture. CTA “Buat hadiah” di desktop/mobile dan CTA template beranda memakai `https://bloomora.my.id/templates` (apex, tanpa `www`). Pengguna melaporkan aturan domain Vercel sudah diperbarui; dashboard tidak diperiksa ulang setelah laporan itu. Seluruh perubahan kerja harus di-commit lalu langsung di-push ke `https://github.com/azriel-ae/bloomora.git`; setelah push, catat hash dan pastikan working tree bersih.

## Proyek

Bloomora adalah platform hadiah digital: pengguna memilih template, menulis hadiah, menerbitkannya, dan membagikan lewat URL publik unik. Antarmuka aplikasi hanya Bahasa Indonesia; data template lama yang menyimpan copy en/id bukan pilihan bahasa UI. Domain resmi: `https://bloomora.my.id`. Stack dan struktur: `docs/ARCHITECTURE.md`. Target deploy: Vercel. Repositori tujuan: https://github.com/azriel-ae/bloomora.git

Kondisi awal (zip `bloomora-fixed.zip`) adalah scaffold UI: 3 template statis, editor tanpa penyimpanan, halaman publik placeholder, dashboard angka "-", paket hardcoded, halaman pembayaran/admin deskriptif. Klaim "sudah ada payment/QRIS/editor" di brief awal TIDAK sesuai kenyataan. Semua yang bukan tampilan di dokumen ini dibangun selama pengerjaan.

## Status phase

| Phase | Status |
|---|---|
| 1 Data model, entitlement, rules | Kode selesai. Unit test lulus. Rules belum diuji emulator |
| 2 Template engine | Selesai (unit test) |
| 3 Renderer dan Featured Demo | COMPLETED; build, lint, typecheck, unit, i18n, browser, dan pemeriksaan route lulus pada 2026-11-01 |
| 4 Katalog dan detail template | SELESAI; test unit, i18n, production build, browser katalog, dan regression browser lulus pada 2026-11-01 |
| 5 Editor dan penyimpanan draft | SELESAI; browser editor, unit, build, i18n, dan regresi katalog lulus |
| 6 | Publishing dan halaman publik | SELESAI; build, lint, typecheck, unit, i18n lulus 2026-11-01 |
| 7 | Analytics, Insights & Export | IMPLEMENTASI INTI; typecheck, 67 unit, i18n lulus; closeout berjalan |
| 8 dan seterusnya | Belum dimulai; ikuti gate persetujuan di roadmap |

## Kondisi Supabase dan database

TIDAK ADA koneksi. Tidak ada data produksi. Storage belum disediakan karena billing production provisioning belum disetujui (JANGAN diaktifkan tanpa persetujuan). Rules dan indeks hanya berupa file. Pengujian logika memakai Fake Store. Jangan memakai localStorage atau file lokal sebagai pengganti database.

## Keputusan yang tidak boleh dilanggar

Model B (gift terbit tidak pernah kedaluwarsa karena paket habis), semua tulis lewat server, `gifts` privat terpisah dari `publicGifts`, draft tidak menimpa versi terbit, subscription hanya dari persetujuan admin, tanpa emoji, satu Featured Demo, dan UI Bahasa Indonesia saja. Stacking perpanjangan sudah diimplementasikan; `maxGifts: 1` masih asumsi yang memerlukan keputusan bisnis. Daftar lengkap: `docs/DECISIONS.md`.

## File penting

- `lib/entitlements.ts`, `lib/server/services.ts`, `lib/server/store.ts`: inti aturan akses dan transaksi.
- `lib/model/types.ts`, `content.ts`, `migrate.ts`: skema v2, validasi, migrasi.
- `lib/engine/*`, `lib/engine/templates/*`: template engine dan 4 template.
- `components/gift/*`: renderer. `app/demo/chapter-of-us/page.tsx`: demo.
- `supabase/*.rules`, `supabase/postgres.indexes.json`.
- `tests/unit`, `tests/browser`, `tests/rules`.

Dibuat dan diubah dalam pengerjaan: lihat daftar per phase di `docs/CHANGELOG.md`. Phase 4 memindahkan konsumen UI dari registry lama ke engine, memperbarui middleware locale dan dokumentasi, serta menambah browser test katalog. `lib/templates.ts` dan `tests/unit/legacy-registry.test.ts` dihapus sesuai kriteria Phase 4; tidak ada dokumentasi lama yang dihapus.

## Hasil pengujian terakhir

Terbaru untuk continuation 2026-11-06: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (115/115), `pnpm test:supabase` (3/3), `pnpm check:i18n` (26 bagian), `pnpm build`, renderer browser (111/111), `pnpm test:catalog`, dan `pnpm test:editor` lulus. Lint masih memberi warning non-blocking existing untuk `<img>` upload/checkout dan dependency satu `useEffect`. Supabase tests memakai fixture/local SQL, bukan Supabase live; Storage live, RLS production, dan domain Vercel tidak diuji ulang. Rincian ada di `docs/PROGRESS.md`.

## Bug yang sudah diperbaiki

Lihat `docs/CHANGELOG.md` (Phase 1: migrasi legacy tidak tersimpan; Phase 3: spesifisitas CSS tombol, kebocoran fokus lightbox, tap highlight mobile, bilah atas mobile; Phase 4: locale prefiks kini mengalahkan cookie lama pada render pertama).

## Keterbatasan lingkungan pada snapshot awal

Pada snapshot tersebut sandbox tidak memiliki dependency atau akses jaringan, sehingga integrasi Next, lint, dan build belum pernah dijalankan. Dalam continuation 2026-11-01, dependency aplikasi dipasang dengan lockfile beku; esbuild/Playwright/Chromium untuk harness browser disediakan sementara di luar proyek, tanpa mengubah manifest atau lockfile.

## Pemeriksaan prasyarat (dilakukan pada continuation 2026-11-01)

1. `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`, `pnpm check:i18n`, serta `pnpm test:browser` sudah dijalankan; hasilnya ada di `docs/PROGRESS.md`.
2. Demo, katalog, dan create dibuka dari production build untuk locale id/en dan desktop/mobile; 12/12 pemeriksaan route lulus.
3. Clone `main` cocok dengan seluruh snapshot zip kecuali artefak build lokal; repository bersih sebelum perubahan closeout.
4. Konfirmasi dua divergensi di `docs/DECISIONS.md` dengan pengguna sebelum menyentuh `approveOrder` atau kuota.
5. Jangan menghubungkan Supabase atau mengaktifkan production provisioning.

## Handover Phase 4 → Phase 5 (riwayat sebelum Phase 5 disetujui)

Phase 4 selesai: registry aktif menjadi sumber tunggal untuk katalog, detail, create, homepage, preview editor, fallback `/g/demo`, dan konteks chatbot. File legacy telah dihapus, dan hasil/keputusan dicatat di `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, serta `docs/ROADMAP.md`.

Langkah berikutnya adalah Phase 5: bangun editor berbasis `TemplateConfig`, penyimpanan draft lewat service/route yang sudah ada, konflik versi, preview `GiftView mode="preview"`, serta kontrol media yang jujur (rincian dan gate di `docs/ROADMAP.md`). **Jangan mulai sebelum pengguna menyetujuinya.** Jangan mengaktifkan Supabase/production provisioning dan jangan ubah Model B atau aturan entitlement.

Pada checkpoint saat catatan ini ditulis, Phase 5 belum dimulai dan menunggu persetujuan; instruksi di atas adalah rekam jejak, bukan status terkini.

## Handover Phase 5 → Phase 6 (riwayat checkpoint)

Phase 5 telah diimplementasikan: editor membaca `TemplateConfig`, preview bersama `GiftView`, draft melalui service/API, GET owner-only, autosave berbasis versi dan 409 reconciliation, expiry read-only, media disabled, serta sandbox memori khusus development yang eksplisit. Detail perubahan/hasil ada di `docs/ROADMAP.md`, `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, dan `docs/ARCHITECTURE.md`.

Verifikasi terbaru: `pnpm build` lulus (Next.js 15.5.28, 30/30 halaman statis), build menjalankan lint/typecheck, `pnpm test:unit` 65/65, `pnpm check:i18n` 22 section, `pnpm test:editor` lulus, dan `pnpm test:catalog` lulus. Supabase tidak terhubung; jangan menyatakan tes PostgreSQL/auth produksi sudah dilakukan.

Langkah berikutnya saat checkpoint ini ditulis adalah Phase 6 (publishing dan halaman publik `/g/[slug]`). Instruksi tersebut adalah rekam jejak; Phase 6 kini selesai.

## Handover Phase 6 → Phase 7

Phase 6 telah diimplementasikan: `getPublicGift` membaca public document tanpa subscription, `/g/[slug]` merender revisi publik berversi dengan `GiftView mode="public"`, status nonpublik dan metadata ditangani, serta editor memiliki konfirmasi publish berbasis versi. Kontrol salin link, share, dan QR tersedia di pengalaman penerima. Detail perubahan dan batas pengujian ada di `docs/PROGRESS.md` dan `docs/CHANGELOG.md`.

Phase 7 kini sedang dikerjakan sesuai persetujuan pengguna: dashboard server-side, aggregate public views tanpa identitas, insight publication rate/top gift, dan export JSON/CSV owner-only. Jangan mengaktifkan Supabase/production provisioning, mengubah Model B, atau mulai Phase 8 payment/admin/media pada continuation berikutnya.


## Handover — account-free customer flow continuation (2026-11-02)

The latest continuation removed customer-auth gates from create and editor pages, changed editor draft calls to the guest token APIs, removed public login navigation, added `/admin/login`, and enforced the `admin: true` claim when creating a session. The source compiles and passes typecheck, lint, 70 unit tests, and production build.

Do not claim the full payment/dashboard brief is finished. The repository still needs checkout with email/WhatsApp contact capture, voucher calculation at the server boundary, payment proof upload/submission, admin transaction sales UI, approval-to-publish orchestration for guest orders, durable secure edit-link recovery, rate limiting, and Supabase emulator/production verification. Supabase and Storage remain unconfigured.


## Handover — Phase 8 checkout and sales checkpoint (2026-11-02)

The current `main` branch includes a guest checkout page at `/checkout?giftId=...`, the server-side `/api/guest/orders` endpoint, and an admin-only transaction list at `/admin/orders` backed by `/api/admin/orders`. Checkout uses the existing secure edit token, accepts email/WhatsApp/package/voucher, and computes the amount from server-side package and voucher documents. Admin revenue counts only `approved` orders.

The implementation deliberately does not claim payment completion: payment proof upload is blocked until Supabase Storage is provisioned, and admin approve/reject UI plus proof submission are the next Phase 8 work. Do not add customer authentication or trust price/status values from the browser.


## Handover — pekerjaan yang belum selesai untuk AI berikutnya (2026-11-02)

### Tahap 8: payment, package, voucher, dan admin sales

Fondasi checkout dan transaksi sudah selesai pada commit `ca721b8`, tetapi Tahap 8 belum boleh dinyatakan selesai. Bagian yang masih harus dikerjakan adalah:

1. **Payment method administration — SELESAI** pada `c9e56992e54d8d134c7ee1da5dfd924d1d21a2fe`. Service/UI admin create-update/active/order, public active-only methods, audit log, dan server lookup saat checkout sudah diimplementasikan.
2. **Package administration — SELESAI** pada `cf4374f3073f152c6b12d6806ee5b48254c52e9e`. Service/UI admin mengelola nama, harga, durasi, limit, tier template, order, dan status. Config aktif digunakan pricing/detail/catalog/checkout. Test membuktikan order lama dan subscription dari order lama tetap memakai `packageSnapshot` awal.
3. **Voucher administration — SELESAI** pada `120c24a66fbdeedaebac49aaf0736418328ce632`. Admin CRUD/soft-delete dan validasi server sudah ada; `usedCount` hanya dikelola server dan di-reserve atomik bersama order. Dua checkout concurrent terhadap `maxUses=1` diuji: hanya satu order yang berhasil.
4. **Payment instructions/QRIS.** Buat halaman pembayaran yang membaca detail order dari server dan menampilkan instruksi/metode pembayaran aktif. Jangan mengklaim pembayaran otomatis; sistem saat ini manual.
5. **Payment proof submission.** Belum dikerjakan karena Supabase Storage belum dikonfigurasi. Setelah Storage tersedia, buat upload server-issued dengan validasi tipe, ukuran, kepemilikan order, dan path privat. Tambahkan `submitProof` dengan transisi `awaiting_payment -> proof_submitted`; pelanggan tidak boleh mengubah status langsung.
6. **Admin verification UI.** Tambahkan daftar order pending proof, halaman detail order, preview bukti privat untuk admin, aksi approve/reject dengan alasan, dan riwayat audit. Endpoint approve/reject yang ada tetap harus memeriksa claim admin di server.
7. **Subscription activation and publishing.** Subscription hanya dibuat oleh `approveOrder`. Setelah approval, hubungkan order/gift ke alur hak edit dan penerbitan ulang. Jangan menerbitkan hadiah hanya karena checkout dibuat atau bukti diunggah.
8. **Subscription stacking divergence.** Keputusan bisnis menyatakan perpanjangan aktif harus menumpuk setelah `expiresAt` terjauh, tetapi kode `approveOrder` saat ini belum mengimplementasikannya. Jangan mengubahnya diam-diam; implementasikan bersama unit test atau dokumentasikan keputusan baru.
9. **Guest secure edit recovery.** Token saat ini disimpan di `sessionStorage` browser. Belum ada recovery link email/WhatsApp yang durable. Jangan menaruh edit token di public URL, QR, atau response publik. Recovery memerlukan provider credential dan rate limiting.
10. **Security and abuse controls.** Tambahkan rate limiting pada checkout, validasi voucher, pemulihan link, dan endpoint sensitif. Tambahkan idempotency untuk pembuatan order bila diperlukan agar refresh tidak membuat order ganda.
11. **Tests.** Tambahkan unit/integration tests untuk guest order, voucher race/limits, payment state transitions, admin-only transaction reads, approve/reject idempotency, stacking, serta cross-customer data isolation. Browser-test alur editor -> checkout dan admin sales.

### Tahap 9 dan seterusnya

Setelah Tahap 8 benar-benar teruji, lanjutkan template tambahan sesuai roadmap. Saat ini registry memiliki 4 template, bukan target 43. Jangan mengaktifkan Supabase Storage production atau layanan berbayar tanpa persetujuan pemilik.

### Tahap 10: Supabase

Supabase Admin adapter, rules, dan env contract sudah ditulis tetapi belum diverifikasi terhadap Supabase/PostgreSQL emulator. Belum ada data produksi. Storage belum tersedia. AI berikutnya harus meminta/menyiapkan konfigurasi env dengan aman, menjalankan emulator tests, lalu mendokumentasikan konfigurasi yang masih memerlukan tindakan pemilik. Jangan menaruh secret di repository.

### Kondisi validasi terakhir

Commit `ca721b8` lulus `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (70/70), dan `pnpm build` (38/38 routes). `pnpm test:rules`, Supabase emulator, Supabase Storage, payment proof nyata, dan end-to-end production checkout belum dijalankan. Branch `main` adalah sumber kebenaran.


## Handover checkpoint — item metode pembayaran selesai (superseded)

Sumber kebenaran adalah branch `main`. Checkpoint kode terbaru `c9e56992e54d8d134c7ee1da5dfd924d1d21a2fe` sudah di-push. Admin kini dapat membuat/mengubah, mengaktifkan/menonaktifkan, dan mengurutkan metode pembayaran di `/admin/payment-methods`. Checkout guest mengambil metode aktif dari server, dan pembuatan order menolak ID metode yang tidak ada atau nonaktif. Semua pelanggan tetap tanpa login; metode aktif hanya berupa data/instruksi teks.

Verifikasi checkpoint: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (72/72), `pnpm check:i18n` (23 section), dan `pnpm build` (41/41 static pages) lulus. Supabase emulator/rules, Storage, upload QRIS/bukti, dan browser end-to-end belum dijalankan; jangan klaim tersedia.

Pada checkpoint itu pekerjaan berikutnya adalah #2 Package administration. Item tersebut kemudian selesai pada `cf4374f`, diikuti voucher CRUD/reservation pada `120c24a`. Instruksi checkpoint ini sudah superseded; lihat handover terbaru di bawah. Tahap 9 tetap terlarang sebelum seluruh gate Phase 8 lulus.


## Handover checkpoint — Phase 8 items #1–2 selesai (superseded)

Branch `main` telah menerima code commit `cf4374f3073f152c6b12d6806ee5b48254c52e9e` (package admin) setelah commit metode pembayaran `c9e56992e54d8d134c7ee1da5dfd924d1d21a2fe`. Status terbaru: checkout/sales foundation, CRUD payment method, dan CRUD package selesai. Admin package config mengalir ke pricing, katalog/detail template, dan checkout; order baru menggunakan harga aktif server dan order lama tetap memakai snapshot awal.

Validasi terbaru: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (73/73), `pnpm check:i18n` (24 sections), `pnpm build`, dan `PLAYWRIGHT_PATH=/tmp/bloomora-browser/node_modules/playwright pnpm test:catalog` lulus. Supabase emulator/rules belum dijalankan; Storage, proof upload, dan payment verification belum tersedia.

Pada checkpoint itu pekerjaan berikutnya adalah #3 voucher administration. Item tersebut selesai pada `120c24a`; validasi dan tes dijelaskan di handover terbaru. Instruksi lama sudah superseded. Tugas aktif sekarang #4 payment instructions/order detail. Tahap 9 dilarang sampai seluruh Phase 8 closeout gate lulus.


## Handover checkpoint — Phase 8 items #1–3 selesai (superseded)

Latest stable code checkpoint `120c24a66fbdeedaebac49aaf0736418328ce632` is pushed to `main`. In addition to guest checkout/sales, payment-method CRUD, and package CRUD, voucher management now has admin create/edit/active/soft-delete controls. Voucher definitions are server-validated; order creation recalculates discount and reserves usage atomically by incrementing the voucher counter in the same transaction as order creation. A failed transaction commits neither an order nor a reservation. Soft delete preserves order references/history. Customer login is still not required.

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (76/76), `pnpm check:i18n` (25 sections), `pnpm build`, and `PLAYWRIGHT_PATH=/tmp/bloomora-browser/node_modules/playwright pnpm test:catalog` all pass. Supabase emulator/rules are not run. Storage and secure file proof submission are unavailable.

Item #4 payment detail described here has since been completed in `b9cc0ea`. The active next step is proof submission (blocked on Supabase Storage configuration) and the admin verification work that does not require file upload; see the latest handover below. Phase 9 must not start before all Phase 8 gates and tests are complete.


## Handover checkpoint — Phase 8 items #1–4 selesai (superseded)

Latest stable code commit `b9cc0ea0e20ccfcce2877258f825f57e21b65000` is pushed to `main`. The guest payment-detail page is `/payment/orders/[orderId]`; checkout persists the one-time order access token only in browser session storage, the server stores only its hash, and the order id alone does not grant access. It displays amount/discount, immutable payment-method instructions captured at order creation, and order status with no customer email/phone. Status reloads every 20 seconds and has a manual refresh action. `createGuestOrder` does not mark an order paid, and `approveOrder` remains the subscription activation boundary.

Validation for this slice: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (77/77), `pnpm check:i18n` (26 sections), `pnpm build`, payment-order browser smoke with mocked API, and catalog browser regression passed. Supabase emulator/rules were not run.

Admin order review scaffolding has since been implemented in `6b0de6f`; see the newest handover below. Proof upload and secure preview still require Supabase Storage setup/approval. Phase 9 must remain paused until all Phase 8 gates pass.


## Handover checkpoint — admin review scaffold (superseded)

Latest stable code commit `6b0de6fac1612e7f0a38965d866820c7043264a8` is pushed to `main`. Admin `/admin/orders/[orderId]` now shows order/contact/payment/package snapshots, publication status, proof metadata without raw Storage path, and order-scoped audit history. `/api/admin/orders/[orderId]` remains protected by verified admin claim. Approve/reject services now require `proof_submitted` plus non-empty server proof metadata; rejection reason is audit logged. No subscription can be created without that gate.

Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (78/78), `pnpm check:i18n` (26 sections), `pnpm build`, catalog browser regression, and unauthenticated admin detail browser smoke passed. Supabase emulator/rules were not run.

Subscription stacking has since been implemented in `b8766d2`; see the latest handover below. Proof upload/preview remains owner-Storage dependent; Phase 9 remains prohibited.


## Handover checkpoint — subscription stacking (superseded)

Latest stable code commit `b8766d284e0a4b0818f84412eb8f8ac427458629` is pushed to `main`. Subscription renewal behavior now follows the agreed rule: the approved period begins at the furthest unexpired active subscription expiry, or server approval time if none remains. Approval reads/writes `subscriptionSchedules/{encodedUserId}` atomically with the subscription and order to serialize parallel approvals. Expired and revoked subscriptions do not extend the chain; the schedule ledger is server-only in PostgreSQL rules.

Validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (79/79), `pnpm check:i18n` (26 sections), and `pnpm build`. A concurrency unit test approves two same-owner orders in parallel and verifies contiguous 14-day periods; Fake Store serializes transactions. `pnpm test:rules` was attempted but could not run (`supabase: not found`); `@supabase/rules-unit-testing` is also absent from dependencies, so emulator/rules validation remains pending.

**Phase 8 is still in progress; do not begin Phase 9.** Next unblocked work: complete guest order → approved subscription → gift publication linkage and recovery/abuse controls, then test cross-customer isolation and idempotency. Secure proof upload and private preview require owner-approved Supabase Storage setup; never store payment proof in PostgreSQL or simulate proof/payment. After Storage is available, complete proof submission/preview and run emulator/rules/integration tests.


## Handover checkpoint — guest order-to-publication linkage (superseded)

Latest stable code commit `091fdf4d26f6cf4b42225297b0576bfbd7890c0d` is pushed to `main`. A guest order's `giftId` is verified against its owner during proof-gated admin approval; an unpublished draft is linked to the approved subscription in that transaction. Guest customers can return from the approved order detail to the editor and explicitly publish with their existing edit token. First publication requires the gift's assigned subscription slot to be active; future stacked slots remain waiting until their period starts. Publication snapshots the validated draft version into a revision and public gift atomically. No customer account or automatic publication was added.

Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (81/81), `pnpm check:i18n` (26 sections), `pnpm build`, catalog browser regression, and mocked guest publish browser smoke all passed. The smoke verified the CTA, edit-token header, expected draft version, and public URL. `pnpm test:rules` remains unrun because Supabase CLI is unavailable and `@supabase/rules-unit-testing` is not installed.

Next unblocked Phase 8 work: durable secure edit recovery and abuse/rate/idempotency controls; then integration tests that do not require Storage. Payment-proof upload and private preview remain blocked on owner-approved Supabase Storage configuration; do not store proofs in PostgreSQL, simulate payment, enable billing, or start Phase 9. Keep working on Phase 8.


## Handover terkini — idempotent guest checkout (2026-11-02)

Latest stable code commit `7136d5c6abed881039a5f6764f85c6bc52a63b49` is pushed to `main`. Guest order POST requires a random 256-bit key held in session storage across network retries. A server-side owner-scoped SHA-256 record makes requests idempotent for 48 hours; identical or concurrent retries return the same order and do not reserve voucher usage again. The response returns a newly issued order detail token; up to four previous token hashes remain valid to handle response reordering, with no plaintext token stored. Expired replay records may be reused for a later purchase. Admin proof gating, subscription stacking, and guest gift publication flow are unchanged.

Validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (83/83), `pnpm check:i18n` (26 sections), `pnpm build`, `PLAYWRIGHT_PATH=/tmp/bloomora-browser/node_modules/playwright pnpm test:catalog`, a production browser smoke that simulated a dropped network response and confirmed the same key was reused, and PostgreSQL rules emulator suite (8/8, including owner/admin denial for idempotency docs). Rules testing used temporary Supabase CLI and Rules Unit Testing dependencies matching the project's the configured Supabase stack; `package.json`/lockfile were not changed, so the project-local repeatable runner still needs its tooling dependencies added.

Next unblocked Phase 8 work: durable edit-link recovery and abuse/rate controls using a trusted request identity/provider; avoid trusting spoofable client IP headers or adding unaudited local-only limits. Storage rules and PostgreSQL adapter/integration tests remain. Payment-proof upload/private preview remain blocked on approved Supabase Storage setup. Do not simulate payment, enable billing, or begin Phase 9.

## Handover terkini — durable guest abuse controls (2026-11-02)
Rate limiting durable untuk jalur guest telah diimplementasikan. `lib/security/rate-limit.ts` memakai counter fixed-window yang di-hash dan ditulis melalui transaksi Store; counter scoped ke operasi dan synthetic guest owner yang sudah dibuktikan lewat edit token. GET draft dibatasi 180/menit, save draft 120/menit, dan publish/order action 10/jam. Respons 429 menyertakan `Retry-After`; PostgreSQL rules menolak akses client ke `rateLimits`.

Jangan menambahkan limit berbasis `x-forwarded-for` atau IP header tanpa trusted request identity/provider. Durable edit recovery masih belum diimplementasikan karena membutuhkan provider email/WhatsApp yang disetujui dan konfigurasi rate/delivery yang dapat dipercaya. Payment proof upload/private preview masih menunggu Supabase Storage dan persetujuan production provisioning. Tahap 9 tetap ditutup.

Validasi checkpoint: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (84/84), `pnpm check:i18n`, dan `pnpm build` lulus. `pnpm test:rules` dan PostgreSQL integration test tidak dijalankan karena Supabase CLI serta `@supabase/rules-unit-testing` tidak tersedia di manifest project.


## Handover terkini — secure proof flow and emulator validation (2026-11-03)
The secure proof path is implemented and tested. Guest order detail now offers a bilingual file form for JPG/PNG/WEBP/PDF up to 5 MB. The server authenticates the order access token, derives the owner UID from the order, uploads through Supabase Admin Storage under `paymentProofs/{ownerUid}/{orderId}/`, then transactionally records only metadata and moves the order to `proof_submitted`. Failed metadata commits delete the uploaded object. Admin preview uses a five-minute signed URL and never returns the raw storage path.

Project-local validation tooling is now repeatable: `pnpm test:rules` passes 8/8 PostgreSQL tests, `pnpm test:storage-rules` passes 2/2 Storage tests, and `pnpm test:integration` passes the PostgreSQL guest-commerce integration. The full local gate also passes 85 unit tests, typecheck, lint, i18n parity, build, catalog browser regression, and editor browser regression.

Do not claim Phase 8 complete yet. The remaining external gates are (1) configure and approve Supabase Storage production bucket/Supabase Storage provisioning, then run a real non-production upload/preview smoke without committing credentials, and (2) approve/configure a real email or WhatsApp recovery provider with trusted delivery and abuse limits. Until then, Storage routes return `storage_not_configured` and recovery is not fabricated. Phase 9 stays paused.


## Handover terbaru — provider-neutral recovery foundation (2026-11-03)
A durable recovery core is now present without pretending that delivery exists. `issueGuestEditRecovery` validates the supplied email/WhatsApp against the private gift record, hashes the destination for rate limiting, creates a pending server-only one-time record, and asks an injected `RecoveryDeliveryProvider` to deliver a 30-minute recovery URL. Only after delivery succeeds is the record marked `sent`. `redeemGuestEditRecovery` atomically validates expiry/status, rotates the gift edit token, marks the recovery record redeemed, and returns the new edit token once. Recovery tokens and destinations are never persisted in plaintext; the service returns `recovery_provider_not_configured` when no approved provider is injected.

The remaining work for recovery is deliberately external/configuration-bound: implement an approved email or WhatsApp adapter, add a controlled request/redeem route and UI, set the canonical site origin, and run delivery smoke tests. Do not bypass the provider injection or place edit tokens in public gift URLs/QRs. Unit tests pass 88/88 and the explicit PostgreSQL rule for `guestEditRecoveries` denies all client access.


## Handover — Supabase migration checkpoint 1 (2026-11-03)

The user explicitly authorized a full Supabase-to-Supabase migration and GitHub checkpoints to `https://github.com/azriel-ae/bloomora.git`. Work is on branch `main`. Read `docs/SUPABASE_MIGRATION.md` first, then this file's current migration status, `docs/DECISIONS.md`, and `docs/PROGRESS.md`.

A domain-oriented initial schema exists at `supabase/migrations/20261103000100_initial_schema.sql` (16 tables, package defaults, RLS, private proof bucket). `pnpm test:unit` passed 88/88; `pglast` parsed 45 PostgreSQL statements; static table/bucket checks passed. No Supabase database was configured, so the migration was not applied and no RLS/Storage integration was tested. No Supabase secrets or production data were used. Supabase is still the active backend; do not tell the owner the migration is complete.

Immediate next steps: (1) implement environment validation and server-only Supabase SSR/Auth/Storage clients without inventing credentials; (2) implement a transaction-capable Postgres Store or explicit atomic SQL/RPC operations that preserve all current Store semantics and race-sensitive invariants; (3) run database migration/RLS/Storage and concurrency tests against a local Supabase/PostgreSQL instance; (4) migrate admin-only Auth, guest APIs, commerce, proof and recovery; (5) update docs/env/dependencies and remove Supabase only after parity. Preserve the guest-only customer model and manual QRIS semantics. Push each verified, documented stable checkpoint; never commit `.env`, secrets, user data, or proof files.


## Handover — Supabase migration checkpoint 3 (2026-11-03)

Latest source contains `lib/server/postgres-store.ts` with relational mapping, transaction buffering, SERIALIZABLE isolation, and bounded retry handling. It is intentionally not wired to runtime yet. The schema migration has been extended to match adapter/service behavior, including a deferred slug foreign key so a PostgreSQL-compatible callback may reserve the slug before inserting the gift.

Run `pnpm test:supabase` (2/2 PGlite tests) and `pnpm test:unit` (89/89). The PGlite suite applies the SQL migration using stub `auth`/`storage` schemas and roles, checks anon/authenticated policies, and exercises guest gift/order, rate-limit, idempotency, one-use voucher, proof, approval, subscription and entitlement paths. Typecheck, lint, production build, and i18n parity also passed.

**Still pending:** exercise the adapter with the real `postgres` driver against an actual PostgreSQL/Supabase transaction pooler; concurrent race tests; wire runtime only after that succeeds; migrate Supabase Auth/session/owner role and every API/service; implement actual private Storage uploads/previews and policy tests; migrate recovery and abuse controls; browser/security tests; owner-managed project/Vercel configuration; authorized data backfill if a production Supabase dataset exists; rollback-safe cutover and Supabase removal. Supabase is the current runtime. No live Supabase credentials or production data were used. Preserve guest-only customer identity and manual QRIS behavior.

## Handover — Supabase migration checkpoint 4 (2026-11-03)

`lib/server/runtime.ts` now has an explicit `Supabase database configuration` path that constructs the existing pooled PostgreSQL client and `postgresStore()` with server-side timestamps and UUIDs. Supabase remains the default and no partial Supabase configuration can switch the runtime accidentally. This checkpoint was implemented without live credentials; keep the flag at `supabase` until production-driver/pooler, concurrency, Auth, Storage, endpoint, and security validation succeeds.

## Handover — Admin workspace redesign (2026-11-03)
The admin experience now uses a dedicated responsive shell at `/admin`: customer header/footer/chat chrome is omitted, navigation is limited to implemented features, and logout signs out Supabase Auth, clears the server session, and redirects to `/admin/login`. The dashboard overview reads actual order/gift records and counts approved revenue only.

Payment methods now support optional JPG/PNG/WEBP images up to 5 MB. Upload/delete is mediated by `/api/admin/payment-methods/image` using the server-only Supabase service role; the browser never receives that key. Apply the migration to create `payment-method-images` and the `image_url`/`image_path` columns. Checkout shows an image only when present and otherwise keeps the existing text-only flow.

Validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (89/89), `pnpm build`, and `git diff --check`. Production Supabase upload/auth smoke testing remains configuration-dependent and was not claimed.

## Handover checkpoint — preview device dan automatic payment order (2026-11-04)

Checkpoint terbaru menambahkan kontrol Mobile/Desktop pada `components/gift-editor.tsx`. Kedua mode menggunakan `GiftView` yang sama dengan content draft yang sama; state toggle lokal tidak ikut tersimpan ke draft. `savePaymentMethod` kini menerima `sortOrder` opsional: input lama yang eksplisit tetap kompatibel untuk migrasi/test, sedangkan payment method baru dari UI mendapat urutan berikutnya secara otomatis melalui transaction server.

Validasi: typecheck, 89 unit tests, i18n parity 26 section, lint (existing `<img>` warnings only), dan production build 40 routes lulus. Belum ada klaim koneksi Supabase live atau browser E2E pada checkpoint ini. Lanjutkan dari audit payment method typed fields/QRIS dan template Birthday Party, lalu push setiap checkpoint stabil.

## Handover checkpoint — typed payment method (2026-11-04)

Commit `85ab3d6` menambahkan payment type dan detail provider/account untuk bank transfer, e-wallet, QRIS, dan metode lain pada model, service, admin form, serta PostgreSQL adapter. Bank dan e-wallet divalidasi server-side sesuai field wajib; QRIS dapat disimpan tanpa nomor rekening dan statusnya tidak mengklaim validitas payload. Jalankan `supabase/migrations/20261104000200_payment_method_details.sql` secara manual sebelum memakai kolom baru pada Supabase.

## Handover checkpoint — automatic payment method ID (2026-11-04)

Commit berikutnya menghapus kebutuhan input ID manual dari admin form. Service menerima ID kosong untuk create, menghasilkan slug internal yang unik dari nama/provider, dan hanya memakai ID yang dikirim saat edit. ID lama tidak pernah diganti.

## Handover checkpoint — login dan admin navigation performance (2026-11-04)

Commit ini mengurangi round-trip RSC saat login/logout, mendeduplikasi `getCurrentUser` dalam satu request server, dan menonaktifkan prefetch massal pada menu admin. `app/admin/loading.tsx` memberi feedback langsung saat server page sedang berpindah. Supabase live latency masih perlu diukur pada environment pengguna; optimasi ini tidak melemahkan pemeriksaan auth server-side.

## Hotfix handover — payment method save error (2026-11-04)

Instruksi pembayaran sekarang benar-benar opsional. Jika production Supabase belum menjalankan `supabase/migrations/20261104000200_payment_method_details.sql`, simpan metode typed dapat gagal karena kolom `payment_type`, `provider_name`, `account_number`, `account_holder`, atau `qris_detection_status` belum ada; response kini menandai `payment_method_schema_outdated` secara spesifik.


## Handover — Payment Method save, Auth, dan SQL manual (2026-11-04)

Root cause yang dapat dibuktikan dari repo: implementasi menulis kolom `payment_type`, `provider_name`, `account_number`, `account_holder`, dan `qris_detection_status`, sedangkan migration initial tidak membuatnya; kolom itu tersedia hanya setelah `20261104000200_payment_method_details.sql`. Catatan handover sebelumnya menyebut mismatch ini sebagai blocker. Apakah migration 002 sudah diterapkan pada project Supabase yang sedang dipakai belum dapat dipastikan tanpa akses schema/log project tersebut. Jalankan verifikasi di `docs/SUPABASE_MANUAL_SQL.md`; jangan mengklaim database live sudah diperbaiki.

Kode Payment Method kini memakai session Auth server-terverifikasi tanpa syarat role admin khusus untuk halaman/API/save/list dan upload/delete gambar. User tanpa sesi tetap ditolak, dan metode publik tetap read-only serta aktif-saja. Error database dipetakan ke kode `payment_method_schema_outdated`, `payment_method_access_denied`, kategori constraint/field, conflict, atau `payment_method_save_failed`; log server hanya mencatat code/pesan tersanitasi. Upload gambar hasil save yang gagal dibersihkan bila aman; gambar lama tidak dihapus sampai metadata baru berhasil tersimpan.

Migration baru: `supabase/migrations/20261104000300_payment_method_authenticated_management.sql`. Jalankan manual sesuai `docs/SUPABASE_MANUAL_SQL.md` setelah schema awal dan migration typed details. Migration menutup policy table lama dengan set yang eksplisit; anon/public tidak memperoleh INSERT/UPDATE/DELETE. Storage tetap public-read untuk bucket payment images, sedangkan operasi terautentikasi dibatasi ke folder UID. Tidak ada SQL dijalankan oleh agent ke Supabase.

Verifikasi lokal: typecheck lulus; unit test 91/91; PGlite migration/RLS/Storage 2/2; i18n lulus; production build lulus (40/40 halaman); lint lulus dengan warning `<img>` yang ada pada komponen manager/admin dan checkout. Supabase live/Auth/Storage browser smoke belum dijalankan. Setelah SQL diterapkan, uji `bank_transfer`, `e_wallet`, QRIS tanpa nomor rekening, upload opsional, update/nonaktif, dan active-only checkout di project non-production.


## Handover — laporan Save masih `payment_method_schema_outdated` (2026-11-04)

Project Supabase tidak terhubung ke workspace ini: variabel `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `DATABASE_URL` tidak tersedia; `.env`, `.env.local`, `.env.production` juga tidak ada. Karena itu tidak ada pemeriksaan schema live dan tidak boleh menyatakan kolom database aktual mana yang hilang.

Bug pasti pada handler lama ditemukan: kondisi `code === '42703' || code === 'PGRST204' || /payment_type|.../.test(message)` menandai semua undefined-column/cache errors sebagai `payment_method_schema_outdated`. Save menulis ke `payment_methods`, lalu menulis `admin_audit_logs` dalam transaksi yang sama; error missing column pada audit table pun dapat disamarkan sebagai mismatch Payment Method. Handler sekarang mengharuskan SQLSTATE + nama tabel dan kolom kontrak yang spesifik. Missing table/column pada `admin_audit_logs` mendapat kode terpisah. Log server menyertakan code/schema/table/column/constraint/message yang disanitasi dan tidak dikirim ke browser.

Jalankan file read-only `supabase/diagnostics/diagnose_payment_method_schema.sql` (SELECT-only) di SQL Editor dan kirim seluruh result grid. File itu membandingkan 16 kolom Payment Method yang dipetakan adapter, menampilkan schema `admin_audit_logs`, constraint/grant/RLS/policy dan bucket tanpa membaca data transaksi. Jangan jalankan migration baru sebelum hasil ini ada. Migration canonical `20261104000200_payment_method_details.sql` dan permission migration 003 sudah ada di repo; tidak dibuat migration speculative karena SQL terbaru telah dilaporkan dijalankan dan database aktual belum diketahui.

Validasi checkpoint ini: unit test 92/92, PGlite 2/2 (migration/RLS/Storage dan eksekusi script diagnosis), typecheck, i18n parity, lint dan build 40/40 berhasil. Lint/build warning `<img>` yang sudah ada. PGlite hanya fixture lokal: INSERT/UPDATE/DELETE belum diuji pada Supabase live. Jalankan diagnosis di SQL Editor dan kirim result grid sebelum migration koreksi dibuat.


## Handover — replay bundle migrations lengkap

File `supabase/manual_apply_all_migrations.sql` menggabungkan migration 001–004 dalam satu transaksi dan urutan. Constraint FK migration awal dijaga dengan cek nama; policy awal di-drop/re-create; migration 003 melakukan RLS/grant akhir Payment Method. Script diuji replay dua kali pada PGlite yang sudah memiliki data, tidak menghapus baris Payment Method atau menimpa harga package, dan mempertahankan 5 policy Payment Method serta 4 policy Storage.

Skrip tidak menghapus tabel/kolom/baris, tetapi bukan schema-reconciliation universal: tabel existing dengan tipe/default/constraint kustom tidak diperbaiki oleh `CREATE TABLE IF NOT EXISTS`. Untuk kasus error aktif ini, diagnosis SQL read-only tetap langkah yang disarankan; bundle adalah opsi pengguna untuk replay seluruh SQL project. Tidak ada statement dijalankan pada Supabase live.


## Handover — optional Auth admin profile seeding

Bundle SQL memiliki `set local bloomora.admin_email = '';` yang default-nya skip. Pemilik dapat mengubahnya ke email tepat milik satu user yang sudah dibuat/invited di Supabase Auth; blok hanya menambah role `admin` di `public.admin_profiles`. Ia tidak membuat user/password atau menulis `auth.users`. Jika entire project/Auth user dihapus, user harus dibuat kembali melalui Dashboard > Authentication > Users sebelum bundle dijalankan dengan email tersebut.

Penting: file gabungan bukan backup/restore dan tidak dapat mengembalikan metode pembayaran, order, gift, subscription, atau user/data lama. Jangan hapus database untuk memperbaiki Save tanpa backup dan rencana restore.

## Handover terbaru — custom public URL di checkout (2026-11-04)

Checkout kini mengambil slug draft guest, menyediakan edit input/preview, dan memeriksa availability lewat `/api/guest/gifts/{giftId}/slug` dengan edit token. `createGuestOrder` menerima `customSlug`, lalu membuat reservasi dan memperbarui `gifts.slug` di transaksi pembuatan order yang sama. Tes race memastikan satu dari dua guest yang merebut slug yang sama menang. Slug yang sudah terbit atau memiliki order awaiting-payment/proof-submitted/approved terkunci. Schema yang ada (`gifts.slug UNIQUE`, `slug_reservations.slug PRIMARY KEY`) telah mencakup uniqueness; belum ada SQL baru.

Validasi selesai: `pnpm typecheck`, `pnpm check:i18n` (26 section), `pnpm test:unit` (93/93), `pnpm test:supabase` (3/3 PGlite), `pnpm lint`, dan `pnpm build` (40 routes) lulus. Lint/build mengeluarkan warning `<img>` pada rendering gambar payment; checkout browser E2E dan koneksi Supabase live/concurrency tidak diuji. Catatan batasan: draft slug acak sebelumnya tetap dicadangkan, tidak ada workflow pembatalan/expiry yang melepaskan reservasi; edit URL lintas perangkat `/edit/{token}`, customer media upload, customer success page/QR, dan penghapusan transaksi admin belum diselesaikan oleh slice ini. Tidak ada SQL dijalankan. Push/commit SHA dicatat pada laporan sesi setelah diverifikasi di remote.


## Handover — private Edit URL lintas perangkat (2026-11-04)

Route baru `/edit/{token}` menghitung hash token, mencari `gifts.editTokenHash`, mengecek expiry/deleted, lalu membuka editor untuk gift yang cocok. Raw token tidak disimpan di DB; halaman noindex/no-referrer. Tombol “Copy edit link” tampil pada editor aktif dan memberi peringatan bahwa link mengizinkan edit bagi siapa pun yang memegangnya. Token sesi sekarang per gift di `sessionStorage`, fallback ke key lama. `edit` disisihkan dari custom slug. PostgreSQL Store kini mengizinkan filter query `editTokenHash` melalui kolom `edit_token_hash`; schema tidak berubah.

Tes lulus: typecheck, unit 94/94, PGlite 3/3, i18n parity, lint, dan production build (40 static pages). Browser smoke dan Supabase live belum dijalankan. Edit URL adalah bearer secret walau hash token di database; jangan memublikasikannya. Tidak ada SQL dijalankan.


## Handover — public gift / verified-order success page (2026-11-04)

`/g/{slug}` tidak lagi memasang `PublicGiftActions`; public gift hanya menampilkan experience template. Pada detail order guest yang dilindungi order token, `getGuestOrderDetail` mengembalikan `giftSlug` hanya jika order approved, gift status published, revision terisi, dan row public gift berstatus published. Success actions menyediakan copy/open/share URL dan QR PNG/SVG. Edit link terpisah hanya muncul jika session browser masih memegang per-gift edit token. Approved but unpublished state menjelaskan owner masih perlu publish melalui editor; fitur belum auto-publish saat approval.

Tes: typecheck, unit 94/94, PGlite 3/3, i18n parity, lint, production build 40/40 lulus. Tidak ada browser E2E karena npm harness tidak memiliki `esbuild`/`playwright` module; Supabase live tidak tersedia. Tidak ada migration/SQL baru.


## Handover — private customer photo/audio upload (2026-11-04)

`POST/GET /api/guest/gifts/{giftId}/media` menggunakan `x-bloomora-edit-token` per gift. POST mengunggah ke private Supabase bucket `gift-media` melalui service-role server only, memvalidasi package entitlement/photo quota, kind/MIME, magic bytes dan batas 25 MiB, lalu menulis content refs dan `gift_media` metadata dalam transaction dengan `expectedVersion`. Jika transaksi gagal setelah upload, object sementara dibersihkan. GET mengembalikan signed URLs berumur 15 menit hanya setelah edit token valid. Public gift baru menandatangani media dari public snapshot; tidak ada bucket public URL atau Storage client key di browser.

Editor memerlukan draft tersimpan untuk upload, flush autosave sebelum file diproses, menampilkan foto pada gallery dan audio pada music player, serta refresh signed URL setelah reload. Opt-in deployment: set `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED=true` hanya setelah migration `20261104000100_customer_media_storage.sql`, private bucket, DB schema dan server-only service-role env tersedia. Saat ini sandbox tidak mempunyai Supabase credentials, sehingga flag tetap off secara default; tidak ada Supabase live write, database SQL apply, atau deployment yang dilakukan. Ikuti incident note/diagnostic di `docs/SUPABASE_MANUAL_SQL.md` sebelum replay migration pada project yang sudah ada.

Validasi: typecheck/lint/build (40 routes), 98 unit tests, 3 PGlite tests, i18n 26 sections, dan `git diff --check` lulus. PGlite memakai migration file secara lokal; ini bukan Supabase live/Storage smoke. Belum diuji: browser E2E upload, deployment/env toggle, atau ukuran/quota terhadap Storage production.


## Handover — transaction soft-delete untuk admin dan pemilik guest (2026-11-04)

DELETE admin ada pada `/api/admin/orders/{orderId}` dan diakses dari detail admin; server mewajibkan actor admin terverifikasi. Pemilik order guest dapat meminta soft-delete pada `/api/guest/orders/{orderId}` hanya dengan `x-bloomora-order-token` yang valid. Karena keputusan auth Bloomora tidak memiliki akun customer, token order yang bersifat bearer adalah bukti pemilik di halaman detail order, bukan login customer baru. Token invalid/lintas order diberi `404`. Owner/admin action tidak disyaratkan menunggu masa subscription habis. Pengulangan request aman/idempotent.

Ini tombstone `orders.deletedAt/deletedByUid`, bukan hard delete, cancel, reject, revoke, atau gift deletion. Order status, proof/payment snapshots, voucher usage, gift/public gift, subscription, dan approved historical revenue tetap ada. Daftar operasional/recent mengecualikan tombstone; admin audit mencatat `order.delete`. Confirmation UI menerangkan efek sebelum action. Untuk Supabase, jalankan migration additive `supabase/migrations/20261104000400_order_soft_delete.sql` secara manual atau bundle `supabase/manual_apply_all_migrations.sql` setelah mempertimbangkan schema project; jangan menjalankan kedua prosedur sebagai otomatis. Tidak ada SQL live yang dijalankan.

Validasi gabungan final: typecheck, lint, unit 100/100, PGlite 3/3, i18n parity 26 sections, `pnpm build` (40 routes), dan `git diff --check` lulus. Lint memberi warning `<img>` existing saja. PGlite bukan uji Supabase live. Lihat `docs/SUPABASE_MANUAL_SQL.md` untuk urutan migration manual.


## Handover — checkout hanya memerlukan satu kanal kontak (2026-11-04)

Checkout guest kini menerima email-only atau WhatsApp-only; form memberi label opsional pada keduanya, tetapi meminta minimal satu untuk informasi transaksi. Format value yang dipilih tetap diverifikasi server-side; invalid contact mendapat pesan dekat field, dan error tidak menghapus state form. Kolom DB kedua contact sudah nullable sehingga tidak ada migration/SQL. Regresi service menolak request kosong dan memverifikasi persistensi `null` bagi field yang tidak dikirim. Validasi terbaru: typecheck, unit 101/101, i18n 26 sections, lint, build 40 routes, `git diff --check`; PGlite 3/3 terakhir dijalankan sebelum slice schema-free ini. Tidak ada browser E2E/live Supabase.


## Handover terbaru — ekspansi Bloomora (2026-11-05)

Mulai dari branch `main` dan baca `docs/PROGRESS.md`, `docs/ROADMAP.md`, serta `docs/template-engine.md`. Pada batch pertama katalog memiliki 12 template aktif: 4 lama + 8 baru yang didefinisikan di `lib/engine/templates/expanded-collection.ts`. Kategori baru dan pencarian memakai `lib/engine/categories.ts`; registry tunggal `lib/engine/registry.ts` tetap sumber kebenaran. `Theme.flowerTransition` opsional dipakai pada desain terpilih dan reveal dihentikan saat reduced motion aktif. Featured Demo tidak berubah.

Target brief pengguna adalah minimal 40 template BARU di luar template yang ada. Baru 8/40 selesai pada checkpoint ini; 32 belum dikerjakan. Jangan mengklaim katalog selesai dan jangan hanya mengganti warna/judul untuk mengejar jumlah. Tambahkan tiap batch sebagai konfigurasi terkurasi, lulus `validateTemplateConfig`/unit test, verifikasi varian renderer, responsif/browser di desktop dan mobile, lalu catat status dan push commit stabil ke `main`. Jangan mengubah data gift yang sudah tersimpan atau mengubah versi template yang sudah diterbitkan.

Verifikasi checkpoint: `pnpm typecheck`, `pnpm lint` (warning existing `no-img-element` saja), `pnpm test:unit` (102/102), `pnpm check:i18n`, `pnpm build` (40 routes), dan `git diff --check` lulus. `pnpm test:catalog` tidak dapat dijalankan karena Playwright tidak tersedia; cek browser/visual mobile belum terverifikasi. Repo tidak memiliki konfigurasi Supabase live yang diverifikasi.


## Handover terbaru — ekspansi katalog batch 2 (2026-11-05)

Checkpoint kedua memperluas katalog menjadi 20 template aktif: 4 yang sudah ada dan 16 baru. Delapan tambahan terbaru adalah anniversary `anniversary-seasons-kept`, Valentine `valentines-postmark`, apology `apology-staying-present`, wedding minimalis `wedding-quiet-ivory`, wedding tradisional `wedding-aksara-evening`, birthday surprise `birthday-midnight-table`, friendship `friendship-city-atlas`, dan Idulfitri `eid-homeward-table`. File konfigurasi tetap `lib/engine/templates/expanded-collection.ts`; seluruh template terdaftar di registry yang sama, bukan sistem terpisah. Progress permintaan 40 template baru: 16/40 selesai, 24 tersisa.

Validasi batch kedua: typecheck, lint (warning `no-img-element` existing saja), unit 102/102, i18n parity 26 sections, production build 40 routes, dan diff check lulus. Browser test tetap tidak dapat dijalankan karena Playwright tidak tersedia; jangan klaim inspeksi visual/mobile. Supabase live tidak dikonfigurasi atau diuji. Teruskan batch berikutnya, verifikasi, dokumentasikan, lalu push commit stabil ke `main`; jangan mengubah konten gift existing.


## Handover terbaru — ekspansi katalog batch 3 (2026-11-05)

Batch ketiga menambah delapan template: wedding floral `wedding-blossom-parchment`, luxury `wedding-gold-editorial`, intimate `wedding-intimate-afterglow`, engagement `engagement-first-to-forever`, bridal shower `bridal-shower-gathering`, Mother’s Day `letter-for-mother`, graduation `graduation-work-in-the-margins`, dan Christmas `christmas-window-light`. Registry berisi 28 template aktif total (4 lama + 24 baru); target minimum 40 template baru kini 24/40, dengan 16 masih tersisa. Template tetap melalui editor dan renderer engine Bloomora yang sama.

Validasi batch ketiga: `pnpm typecheck`, `pnpm lint` (warning `no-img-element` existing), `pnpm test:unit` 102/102, `pnpm check:i18n` 26 sections, `pnpm build` 40 routes, dan diff check lulus. Browser visual/catalog/mobile tetap belum tervalidasi karena Playwright tidak tersedia. Supabase live tidak digunakan. Lanjutkan per checkpoint, update progress, dan push ke `main` setelah validasi.


## Handover terbaru — ekspansi katalog batch 4 (2026-11-05)

Batch keempat menambah delapan konfigurasi: apology persahabatan `apology-friendship-repair`, birthday keluarga `birthday-mothers-sunday`, farewell `farewell-last-train`, moving-away `moving-away-photo-route`, gender reveal `baby-gender-reveal-garden`, Father’s Day `fathers-day-built-together`, Tahun Baru `new-year-room-to-begin`, dan anniversary perjalanan `anniversary-miles-and-mornings`. Katalog sekarang 36 template aktif: 4 lama + 32 baru; target minimum 40 template baru mencapai 32/40, delapan lagi tersisa.

Validasi batch keempat: typecheck, lint (warning `no-img-element` existing), unit 102/102, check:i18n 26 sections, production build 40 routes, dan diff check lulus. Playwright/browser visual tidak tersedia di sesi ini, jadi katalog desktop/mobile belum diverifikasi langsung. Supabase live tidak diuji. Pertahankan checkpoints kecil dan push stabil ke `main`.


## Handover terbaru — target ekspansi katalog tercapai (2026-11-05)

Batch kelima menambah delapan desain terakhir: wedding destination `wedding-coastal-letters`, city-hall `wedding-city-hall-promise`, anniversary long-distance `anniversary-distance-letters`, birthday milestone `birthday-first-light`, apology saudara `apology-sibling-open-door`, graduation first-generation `graduation-first-in-family`, friendship archive `friendship-voice-note-archive`, dan Lunar New Year `lunar-new-year-open-table`. Target minimum kini selesai: 40 template baru di luar 4 template yang telah ada, sehingga registry memiliki 44 template aktif. Semua menggunakan engine/registry, katalog, detail, editor, checkout/publish, dan public renderer yang sama.

Final gate: `pnpm typecheck`, `pnpm lint` (warning `no-img-element` existing), `pnpm test:unit` (102/102), `pnpm check:i18n` (26 sections), `pnpm build` (40 routes), dan `git diff --check` lulus. Browser catalog/mobile belum diverifikasi karena Playwright tidak tersedia. Supabase live tidak diuji. Push final dilakukan sebagai checkpoint terpisah.

## Handover — responsive composition seluruh template (2026-11-05)
Responsive pass diterapkan di layer terakhir `components/gift/gift.css`, sehingga semua template dan halaman yang memakai `GiftView`/renderer bersama ikut mendapat perbaikan tanpa migrasi data atau perubahan versi gift. Mobile 320–360px, 375–430px, tablet dan desktop mempertahankan hubungan visual desktop; hero/closing tidak lagi memaksa tinggi viewport penuh, spacing dan timeline dipadatkan, gallery/card/media dibuat proporsional, dan art-direction-specific overrides menjaga perbedaan template. `prefers-reduced-motion` tetap dihormati.

`tests/browser/build.mjs` mendapat process-env shim terbatas untuk static harness karena `next/image` mengharapkan env Next runtime. Tidak ditambahkan ke dependency produksi. Typecheck, lint, unit 103/103, build 40 route dan diff check lulus. Browser smoke lulus 117/119: seluruh desktop/mobile interaction dan overflow checks lulus; dua assertion SSR fixture emoji/script existing gagal. Catalog tidak dapat dijalankan karena `next start` tidak menemukan `.next/BUILD_ID` pada build ini; editor berhenti pada assertion localization existing. Sebelum deployment tetap lakukan browser catalog/editor dengan Next build yang menghasilkan BUILD_ID, serta visual check perangkat nyata. Tidak ada data gift pelanggan yang diubah.


## Handover — custom slug dianggap selalu digunakan (2026-11-05)

Root cause terkonfirmasi di `lib/server/guest-services.ts`: availability sebelumnya mengembalikan `reservation === null || reservation.giftId === giftId`, tanpa menilai status gift, order, atau expiry. Schema awal juga mendeskripsikan reservation sebagai permanen. Akibatnya draft testing dan checkout unpaid lama dapat mengunci nama selamanya.

Implementasi terbaru memperkenalkan pemeriksaan owner aktif berbasis server clock dan hold unpaid 48 jam. Claim tetap terjadi di SERIALIZABLE transaction; unique key `slug_reservations.slug` dan unique `gifts.slug` tetap melindungi race. Saat owner lama hanya draft/deleted tanpa order aktif, owner lama dipindah ke generated slug baru sebelum custom slug direclaim. Published gift yang masih aktif tidak pernah dipindah.

File SQL `supabase/migrations/20261105000100_slug_reservation_lifecycle.sql` menambah `expires_at`, `order_id`, dan index lifecycle secara additive. `supabase/slug_conflict_report.sql` hanya read-only untuk investigasi terarah. Jangan menjalankan DELETE massal. Terapkan migration lalu jalankan report untuk slug yang dilaporkan sebelum menilai data legacy.

Gate terbaru: `pnpm typecheck` lulus; `pnpm test:unit` **105/105** lulus; `git diff --check` lulus. Belum diverifikasi terhadap Supabase production/live data. Setelah migration diterapkan, uji manual: slug baru `davidddddaa`, published conflict, active checkout conflict, owner resume, cancelled/rejected reuse, unpaid >48h reuse, dan dua checkout paralel.

## Handover terbaru — checkout diagnosis and voucher apply (2026-11-05)
The checkout error is now identified: the custom-slug lifecycle code writes `expires_at`/`order_id` to `slug_reservations`, while an environment that has not applied `supabase/migrations/20261105000100_slug_reservation_lifecycle.sql` throws PostgreSQL `42703 column "expires_at" ... does not exist`. The API previously let this unexpected exception become a generic customer error. The route now logs bounded server metadata and returns `order_create_failed`; do not expose raw SQL details.

Run the migration on the target Supabase project before retrying checkout. The integration harness now includes it and passes. Voucher validation is available at `POST /api/guest/vouchers/validate`; it verifies the guest token and package price without consuming usage. Checkout applies on Enter/Apply, clears stale discounts after package changes, and the final order transaction remains authoritative.

## Handover terbaru — guest media sebelum checkout (2026-11-06)

Guest draft memakai edit-token bearer yang valid sebagai otorisasi upload foto/audio sebelum paket dipilih atau dibayar. Route media tetap server-mediated: bucket `gift-media` private, Storage client tidak pernah masuk browser, file divalidasi MIME dan magic bytes, ukuran maksimum 25 MiB, URL hanya signed, dan optimistic `expectedVersion` mencegah lost update. Subscription tidak lagi dipakai sebagai gate upload karena batas paket baru diputuskan saat checkout.

Autosave/load/publish draft menerima media yang sudah diunggah dan autosave menolak referensi dengan path di luar `private/{giftId}/`. Saat checkout, server menghitung foto/audio dari draft lalu menolak paket dengan `package_photo_limit_exceeded` atau `package_music_not_included` jika limit tidak mencukupi. UI checkout menandai paket yang tidak eligible dan memberi alasan; isi draft tidak dihapus otomatis.

Checkpoint kode `1ee5ce8` sudah dipush ke `origin/main`. Verifikasi: install frozen, typecheck, lint, dan unit test 105/105 lulus. Belum diverifikasi: Supabase live/Storage production, deployment env, serta browser/device smoke upload.

## Handover terbaru — Tahap 2 checkout, QRIS, dan proof hardening (2026-11-06)

Checkout payment-method selection sekarang hanya menampilkan nama, indikator radio, dan thumbnail kecil. Snapshot instruksi tetap dibuat server-side saat order dibuat; halaman detail order menampilkan instruksi, detail rekening/e-wallet, QRIS asli, dan tombol unduh QRIS. Tidak ada penggambaran ulang atau perubahan payload QRIS.

Payment proof route memakai private bucket `payment-proofs`, order bearer token, server-generated path, hash deduplikasi, dan sekarang magic-byte validation untuk JPEG, PNG, WEBP, dan PDF. `submitGuestPaymentProof` tetap menjadi satu-satunya transisi ke `proof_submitted`; approval tetap proof-gated dan idempotent.

Checkpoint terbaru `9bd7e21` sudah dipush. Sebelumnya `c12ede5` dan `6143fa7` juga sudah dipush. Validasi terakhir: i18n, typecheck, lint, unit 106/106. Belum dilakukan: Supabase live Storage smoke, browser E2E, dan verifikasi deployment migration target.

Checkpoint `c7021dc` memperbaiki copy id/en proof upload: pelanggan diberi tahu file disimpan privat dan diperiksa manual, bukan selalu diberi pesan bahwa upload belum tersedia. I18n parity lulus dan branch bersih setelah push.


## Handover — hapus foto guest dan pengelolaan desain QRIS (2026-11-06)

Root cause hapus foto bukan koneksi internet. `deleteGuestMedia` membaca `giftMedia` setelah `tx.update(gifts/...)`; FakeStore dan PostgreSQL adapter sama-sama memakai kontrak read-before-write. Perbaikan membaca metadata serta seluruh reference storage sebelum write, lalu melakukan soft-delete metadata dan update draft secara atomik. Storage object dihapus hanya jika path tidak memiliki reference aktif lain. Edit-token tetap menjadi bukti ownership guest; token salah ditolak sebelum metadata atau Storage disentuh.

Pada halaman `/admin/payment-methods`, `QrisDisplayManager` menyediakan preview langsung dan pengaturan sederhana. Konfigurasi QRIS berada di tabel baru `qris_display_settings` dan endpoint `/api/admin/payment-methods/qris-display`; GET publik hanya menerima konfigurasi melalui daftar metode aktif, PUT melewati `withActor` dan `requireAdmin`. Config divalidasi ketat untuk hex colors, panjang teks, frame, dekorasi, dan logo URL. Dekorasi hanya berada di frame luar; gambar QR asli dipertahankan sebagai elemen `object-contain` tanpa redraw/crop/recolor/stretch.

Checkout membaca konfigurasi sebelum transaksi menulis order dan memasukkannya ke payment snapshot hanya untuk metode QRIS. Detail order guest merender snapshot tersebut, sehingga konfigurasi baru tidak memengaruhi order lama. Terapkan `supabase/migrations/20261106000100_qris_display_settings.sql` atau bagian terkait dari `supabase/manual_apply_all_migrations.sql`; jangan membuka write policy untuk anon. Setelah deploy, verifikasi admin save/refresh, non-admin denial, checkout snapshot freeze, dan scan QRIS nyata dengan beberapa aplikasi pembayaran.

Gate kode: typecheck, lint, targeted unit tests lulus. Warning lint `<img>` berasal dari gambar payment/QR yang memang dipakai untuk menjaga kompatibilitas; belum dilakukan live Supabase/browser/device smoke.
