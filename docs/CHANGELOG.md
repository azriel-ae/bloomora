# Changelog

## 2026-11-08 — Demo Utama dipilih dari admin dan homepage mengikuti setting

- Memilih `for-you-scrapbook` sebagai Demo Utama melalui `/admin/featured-demo`. Dashboard mengonfirmasi tersimpan dan GET publik `/api/featured-demo` mengembalikan ID baru.
- Smoke test menemukan HTML homepage masih menampilkan demo sebelumnya karena route root terprerender saat build. Homepage kini dipaksa render dinamis agar artwork dan link Demo mengikuti setting terbaru; deployment dan cek HTML live setelah push masih menunggu.

## 2026-11-08 — template scrapbook romantis baru

- Menambahkan `For You, With Love` sebagai template katalog baru dengan halaman pembuka amplop bersegel, menu Letter/Flower/A song for you, surat berpadu polaroid, ilustrasi buket mawar original, serta halaman audio.
- Menambahkan renderer khusus di jalur `GiftView` yang sama agar tampilan konsisten pada preview editor, demo, dan hadiah publik. Template baru tidak mengganti demo unggulan ataupun sistem pemilihan Demo admin yang sudah ada.
- Slot foto kenangan berada di editor bagian surat. Setiap slot memiliki `itemId` stabil dan foto memakai `photoId`; reordering tidak memindahkan foto ke cerita lain. Musik juga dapat ditambahkan dari bagian editor musik. Kontrol upload mengikuti feature flag Storage privat; flag tidak diaktifkan di sandbox ini.
- Merapikan gallery art direction `collage` menjadi dua kolom pada layar kecil. Dokumentasi template engine memuat pola renderer khusus dan ikatan foto berbasis ID.
- Verifikasi lulus: typecheck, lint (hanya warning existing pada admin/checkout), unit test 123/123, browser test 123/123, editor browser integration, i18n check 26 sections, production build 49/49 halaman, dan `git diff --check`. Upload Storage production tidak diuji karena feature flag/bucket tidak aktif di sandbox.

## 2026-11-07 — guest media sebelum checkout

- Guest dengan edit-token yang valid kini dapat mengunggah foto dan satu audio sebelum membayar; status order atau subscription tidak menjadi syarat upload.
- Menambahkan rate limit upload/hapus/signed URL, batas file 25 MB, validasi MIME dan file signature, batas abuse sementara per draf, dan cleanup object Storage ketika transaksi optimistic gagal.
- Checkout tetap memvalidasi jumlah foto dan ketersediaan musik terhadap konfigurasi paket server-side, tanpa menghapus media yang melebihi paket.
- Editor menampilkan media dari signed URL draft tersimpan setelah refresh dan memberikan pesan error yang membedakan format, ukuran, link akses, rate limit, dan batas audio.
- Verifikasi: typecheck, unit test 118/118, lint dengan warning existing, dan `git diff --check` lulus. Supabase Storage/RLS production belum diuji live.

## 2026-11-06 — QRIS crop tervalidasi, cleanup, dan CTA template apex

- Upload admin kini mendeteksi QR secara dinamis, menyediakan manual-crop fallback, memvalidasi payload QRIS/CRC, quiet zone, bentuk persegi, re-decode PNG, dan kesamaan payload sumber/crop. Gambar mentah tidak menjadi QRIS aktif; hanya hasil crop yang dikonfirmasi.
- Preview admin dan halaman order pelanggan memakai `QrisPaymentCard` yang sama. QR dipisahkan pada bidang putih, dekorasi/brand berada di luar area scan, logo memakai aset lokal, dan pelanggan dapat mengunduh kartu PNG final. QRIS display tersimpan dibekukan ke snapshot order.
- Menambahkan route gambar QRIS order-token; `jsqr` dan `html-to-image` menjadi dependency runtime sedangkan ZXing hanya dev fixture. Menghapus `components/publish-dialog.tsx`, `lib/brand.ts`, `react-hook-form`, dan `@hookform/resolvers` setelah referensi aktif tidak ditemukan. Tidak ada migration, RLS, konfigurasi penting, atau fitur aktif yang dihapus.
- Header “Buat hadiah” desktop/mobile serta CTA “Mulai dari template” beranda mengarah ke `https://bloomora.my.id/templates` tanpa `www`. Pengguna melaporkan aturan domain Vercel sudah diubah ke apex; tidak ada perubahan dashboard oleh agent pada checkpoint ini.
- Verifikasi: typecheck, lint (warning non-blocking existing), 115 unit tests, 3 Supabase/PostgreSQL tests, i18n check (26 bagian), production build, 111/111 renderer browser checks, catalog/QRIS browser test, dan editor browser test lulus.

## 2026-11-06 — UI Bahasa Indonesia, domain canonical, dan bunyi balasan chat

- Menghapus kamus English serta language switcher; UI, metadata, demo, admin, chatbot, dan test harness kini menggunakan Bahasa Indonesia. Middleware mengarahkan route `/id/...` dan `/en/...` lama ke route tanpa prefix serta menghapus cookie locale lama.
- Menambahkan canonical domain `https://bloomora.my.id` untuk metadata, robots/sitemap, QR/share, tautan hadiah/edit, dan secure recovery. `.env.example` serta README memuat `NEXT_PUBLIC_SITE_URL` yang tepat; Vercel Project Settings/DNS masih memerlukan penyesuaian produksi.
- Inspeksi Vercel read-only menemukan `NEXT_PUBLIC_SITE_URL` belum ada dan domain apex saat ini redirect 308 ke `www`; tidak ada pengaturan project/account yang diubah. Sesi browser Vercel di-logout atas permintaan pengguna; pembaruan Production env/domain routing tetap tindakan deployment terpisah.
- Menambahkan suara chatbot opt-in yang default mute, memakai Web Audio ringan setelah balasan sukses selesai, serta menghormati mute lokal. Tidak ada asset audio eksternal.
- Menambahkan regression test untuk redirect locale legacy, canonical domain, suara chat sukses/gagal/mute, dan pengecekan kamus satu bahasa. Status hasil verifikasi continuation dicatat di `docs/PROGRESS.md` setelah test dijalankan.

## 2026-11-06 — Locale dari route segment, halaman statis per bahasa

- Semua route halaman dipindahkan ke `app/[locale]/` (`/id`, `/en`). `middleware.ts` selalu me-*rewrite* ke `/{locale}/...` (URL di browser tidak berubah); locale diambil dari prefix, lalu cookie `bloomora_locale`, lalu default `id`.
- `app/[locale]/layout.tsx` tidak lagi memanggil `cookies()`, sehingga halaman informasi (home, about, contact, faq, terms, privacy, refunds, expiration, media-policy, payment, demo chapter-of-us) diprerender per bahasa dan tidak memakai Function per kunjungan.
- Halaman yang membaca data per-request (admin, checkout, create, dashboard, editor, edit, g/[giftSlug], templates, pricing, order payment) tetap `force-dynamic`. Gate pathname (`ChromeGate`, `AdminChromeGate`, `AdminShell`) menerima path dengan/ tanpa prefix locale.
- Tombol bahasa kini menghapus prefix `/id` atau `/en` dari URL sebelum reload, supaya prefix tidak menimpa pilihan baru.
- Route `[...rest]` memanggil `notFound()` agar 404 tampil dengan layout situs.


Pada snapshot awal, perubahan belum pernah dikompilasi oleh `next build`. Closeout Phase 3 berikutnya lulus build pada 2026-11-01; lihat `docs/PROGRESS.md`.

## Dokumentasi

- `docs/ROADMAP.md`: rincian Phase 4 sampai 9 dan tahap Supabase, keamanan, deployment.

## 2026-11-05: editor media, Payment Method, dan responsive renderer

- Menambahkan penghapusan foto/audio guest yang token-authorized dan versioned. Referensi draft langsung diperbarui; metadata media di-soft-delete dan object Storage hanya dihapus jika tidak dipakai gift lain. Versi publik tidak tersentuh.
- Menghapus status pemeriksaan QRIS/`Confirmed By` dari form, tipe, service, adapter, dan API Payment Method. Data `reviewedBy`, proof AI, dan audit order tetap dipertahankan sebagai histori verifikasi transaksi.
- Menambahkan guard responsive bersama pada renderer seluruh template untuk mencegah overflow, menjaga media proporsional, dan meningkatkan target sentuh.
- Validasi: typecheck, lint, production build (40 route), unit test 102/102, dan `git diff --check` lulus. Warning `no-img-element` pada gambar upload tetap existing; visual device nyata dan Supabase live belum dijalankan.

## [Phase 6] 2026-11-01: publishing dan halaman publik

- Mengganti placeholder `/g/[giftSlug]` dengan public-read server path yang hanya membaca `publicGifts`, memvalidasi slug, memilih template berversi, dan merender `GiftView mode="public"` tanpa isian contoh.
- Menambahkan state publik terpisah untuk gift terbit, diarsipkan, dicabut/dihapus, slug invalid, dan storage belum terkonfigurasi; state nonpublik memakai `noindex` dan halaman `/g/` menyembunyikan site chrome.
- Menambahkan dialog konfirmasi publish di editor berbasis `expectedVersion`, kontrol salin link/Web Share, dan QR publik. Audio tetap tidak muncul saat media upload nonaktif.
- Menyelaraskan copy id/en pada halaman recipient, FAQ, dan expiration dengan Model B: gift yang sudah terbit tidak kedaluwarsa hanya karena paket pemilik habis.
- Menambahkan unit test public-read yang membuktikan tidak ada subscription read dan gift tetap tersedia setelah waktu subscription berlalu.
- Lulus: typecheck, lint, production build (30/30 halaman), 66 unit test, i18n parity 22 section, serta `test:catalog` dan `test:editor` dengan Playwright/Chromium sementara di luar manifest. Public gift nyata dari Supabase/fixture server dan Supabase emulator belum digunakan.

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
- Foto/audio ditandai belum tersedia. Sandbox browser tanpa Supabase berupa store process-memory yang hanya aktif dengan `NODE_ENV=development` serta `BLOOMORA_DEV_EDITOR=true`, menampilkan peringatan, tidak memakai localStorage/file, dan ditolak saat production.
- Auth continuation menggunakan path internal terverifikasi. Middleware locale mempertahankan query string saat rewrite; temuan browser sebelumnya akan kehilangan `?template=` telah dikunci oleh regression browser.
- Ditambahkan unit test autosave serta GET privat/expired, `tests/browser/editor.mjs`, dan script `pnpm test:editor`; regression `tests/browser/catalog.mjs` memeriksa alias editor demo menuju demo nyata.
- Lulus: production build (30/30 static pages generated; typecheck/lint build lulus), 65/65 unit test, parity i18n 22 section, browser editor lengkap, dan browser katalog.
- Batas: Supabase/PostgreSQL emulator tidak terhubung, jadi integrasi autentikasi dan penyimpanan produksi tidak diklaim telah diuji. Phase 6 belum dimulai.

## [Phase 3 closeout] 2026-11-01: verifikasi integrasi

- `lib/server/store.ts`: pengecualian ESLint yang dijelaskan untuk tipe dokumen PostgreSQL dinamis; validasi tetap dilakukan pada batas service/domain.
- `lib/server/postgres-store.ts`: adapter memakai alias `Doc` yang sama untuk hasil baca dan query.
- `tsconfig.json`: tes PostgreSQL emulator dikecualikan dari typecheck aplikasi karena `@supabase/rules-unit-testing` tidak termasuk dependency proyek; tes emulator tetap terpisah dan belum dijalankan.
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
- `lib/server/*` (service dengan transaksi atas interface `Store`, adapter PostgreSQL Admin), route `/api/gifts`, `/api/gifts/[id]` (PUT, DELETE), `/publish`, `/state`, `/api/orders`, `/api/admin/orders/[orderId]`.
- Rules PostgreSQL dan Storage (semua tulis dari client ditolak), indeks, `docs/data-model.md`.
- Planner migrasi timestamp ISO ke Timestamp (aditif, idempoten). Skrip penerapan belum ada.
- Diperbaiki: migrasi gift lama tidak tersimpan karena helper selalu memilih `tx.update` (ditemukan unit test).
- Route lama `PUT /api/gifts/[giftId]` diganti (tidak ada pemanggilnya) karena tanpa pemeriksaan entitlement.


## [Phase 8] 2026-11-02: guest checkout and admin sales foundation

- Added `/checkout?giftId=...` for account-free checkout. Customers provide email, WhatsApp, package, and optional voucher; customer authentication is not used.
- Added `/api/guest/orders`. The server validates the secure edit token, package availability, contact fields, payment method, voucher rules, and computes the final amount from server-owned values. Orders store frozen package terms, contact data, original amount, discount, payment method, and gift relation.
- Added `/api/admin/orders` and `/admin/orders`. Admin-only sales views support transaction search, payment-status/package filters, summary counts, confirmed revenue totals, contact details, payment method, discount, and publication state.
- Editor drafts now link to checkout instead of exposing an authenticated publish action. Manual payment remains explicit; payment proof upload and approval-to-publish are still pending Supabase Storage and the next Phase 8 slice.
- Validation: typecheck, lint, 70 unit tests, and production build passed; build generated 38 routes.


## [Phase 8 status] 2026-11-02: continuation handover

The repository documents the exact Phase 8 closeout gate. Checkout, admin sales, payment-method/package/voucher CRUD, atomic usage reservation, secure guest payment details, admin review/detail scaffolding, and subscription stacking are complete. Proof submission/preview, approval-to-publication linkage, secure recovery, abuse controls, and end-to-end/rules tests remain unfinished. Future commits must update this status rather than claiming Phase 8 complete prematurely.


## [Phase 8] 2026-11-02: payment-method administration

- Added admin-only `/admin/payment-methods` and `/api/admin/payment-methods` for create/update, activation/deactivation, and display ordering; each change is validated server-side and audit logged.
- Added public `/api/payment-methods`, which returns active methods only. Guest checkout displays these methods/instructions and sends the selected ID; `createGuestOrder` now requires a matching active server document and no longer accepts the hardcoded QRIS fallback.
- Payment instructions are plain text only. QRIS image upload and payment proof remain unavailable until Supabase Storage is provisioned with owner approval.
- Added unit coverage for admin authorization, validation, sorting, active-only reads, disabling, audit records, and guest checkout rejection of unconfigured/inactive methods.
- Validation: typecheck, lint, 72/72 unit tests, i18n parity (23 sections), and production build (41/41 static pages) passed. Supabase emulator/rules and browser end-to-end were not run.
- Code commit `c9e56992e54d8d134c7ee1da5dfd924d1d21a2fe` was pushed to `main`.


## [Phase 8] 2026-11-02: package administration

- Added admin-only `/admin/packages` and `/api/admin/packages` to manage the fixed Basic/Plus/Premium IDs, editable names, prices, duration, activation, display order, gift/photo limits, music/review entitlements, and template tiers. Server validation and admin audit logging are applied transactionally.
- Active package config now feeds pricing, template eligibility/detail, Featured Demo entry price, and guest checkout at request time; the server still recalculates order amounts. Inactive packages are hidden from customer selection.
- New orders freeze package terms in `packageSnapshot`; tests verify changing price, duration, and limits does not change an existing order or its eventual subscription expiry.
- Validation: `pnpm typecheck`, `pnpm lint`, 73/73 unit tests, i18n parity (24 sections), production build, and catalog browser regression passed. Supabase emulator/rules remain unrun.
- Code commit `cf4374f3073f152c6b12d6806ee5b48254c52e9e` was pushed to `main`.


## [Phase 8] 2026-11-02: voucher administration and atomic reservations

- Added admin-only `/admin/vouchers` and `/api/admin/vouchers` for create/edit, activate/deactivate, date window, percent/fixed discount, maximum uses, minimum amount, and soft-delete with audit records. Soft deletion disables new redemption while preserving order references and usage history.
- Guest order creation now reads and validates voucher definition, calculates discount, increments `usedCount`, and creates the order in one PostgreSQL transaction. Counter is reserved on order creation; a failed transaction makes no reservation. No customer login is introduced.
- Updated the Fake Store to serialize concurrent transactions and added unit tests for admin-only writes, invalid code/date/limit, min/date rejection, soft deletion, preserving counters, and two concurrent checkouts against `maxUses=1`.
- Validation: typecheck, lint, 76/76 unit tests, i18n parity (25 sections), production build, and catalog browser regression passed. Supabase emulator/rules remain unrun.
- Code commit `120c24a66fbdeedaebac49aaf0736418328ce632` was pushed to `main`.


## [Phase 8] 2026-11-02: secure guest payment details

Guest order creation now snapshots the selected payment method name/instructions and issues a high-entropy order access token. The API returns plaintext token only once; only its SHA-256 hash is stored. `/api/guest/orders/[orderId]` requires the token header, is private/no-store, and returns the saved amount/discount/instructions/status without customer email or WhatsApp. `/payment/orders/[orderId]` uses the browser-session token, displays the frozen order details, and refreshes status every 20 seconds plus a manual refresh button. No payment or verification is implied, and proof upload remains unavailable until Supabase Storage is configured. Unit tests verify missing-token denial, no PII, amount math, and snapshot immutability; browser smoke validates rendering. Typecheck, lint, 77/77 unit tests, i18n (26 sections), build, browser smoke, and catalog regression passed. Commit `b9cc0ea0e20ccfcce2877258f825f57e21b65000` was pushed to `main`.


## [Phase 8] 2026-11-02: admin order review and proof guards

Added admin-only `/admin/orders/[orderId]` and GET `/api/admin/orders/[orderId]` for contact/payment/package snapshots, proof metadata (without raw storage path), publication state, and order-scoped audit history. The transaction table links to review detail. Admin approve/reject actions require `proof_submitted` plus non-empty server proof metadata; review without proof is rejected. Rejection reasons are now recorded in the audit event. Unit coverage verifies non-admin denial, no action/subscription without proof, audit reason, and path secrecy. The UI explicitly says secure proof file preview is unavailable until Supabase Storage is configured; no proof or payment is fabricated. Validation: typecheck, lint, 78/78 unit tests, i18n parity (26 sections), production build, catalog browser regression, and unauthenticated admin-page browser smoke passed. Supabase emulator/rules not run. Code commit `6b0de6fac1612e7f0a38965d866820c7043264a8` was pushed to `main`.


## [Phase 8] 2026-11-02: transactional subscription stacking

`planSubscriptionActivation` now starts renewals at the furthest unexpired active period (or server approval time when none remains), preserving frozen package duration. `approveOrder` reads a deterministic per-user `subscriptionSchedules` ledger and active subscriptions in the same transaction, creates the subscription, then updates the ledger so concurrent approvals serialize rather than overlap. Expired/revoked subscriptions do not extend a renewal; the ledger is server-only under PostgreSQL rules. Unit coverage verifies planner boundaries and two simultaneous order approvals produce contiguous periods. Validation: typecheck, lint, 79/79 unit tests, i18n parity (26 sections), and production build passed. PostgreSQL rules test was attempted but could not run (`supabase: not found`; rules-unit-testing dependency absent). Code commit `b8766d284e0a4b0818f84412eb8f8ac427458629` was pushed to `main`.


## [Phase 8] 2026-11-02: guest order approval-to-publication linkage

- Guest orders retain a private `giftId`; admin approval now verifies the linked gift owner matches the order owner and binds an unpublished draft to the newly created subscription in the same transaction. Foreign gift references are rejected.
- Added token-authorized guest publish API. A draft is publishable only after its assigned subscription slot is active; future stacked periods show a waiting state. Publishing validates the exact draft version and template/content, then writes the immutable revision and public gift atomically. No automatic public release on payment approval.
- Approved token-authorized order details now provide a return link to the gift editor. Public copy makes subscription stacking clear; customers still do not need accounts.
- Validation: `pnpm typecheck`, `pnpm lint`, 81/81 unit tests, `pnpm check:i18n` (26 sections), `pnpm build`, catalog browser regression, and guest publish browser smoke passed. PostgreSQL emulator/rules validation remains blocked because Supabase CLI and rules-unit-testing dependency are unavailable.
- Code commit `091fdf4d26f6cf4b42225297b0576bfbd7890c0d` was pushed to `main`.


## [Phase 8] 2026-11-02: idempotent guest checkout retries

Guest checkout now generates a random 256-bit idempotency key in `sessionStorage` and sends it with the guest order request. The server scopes the SHA-256 record to the synthetic guest owner and gift, and transactionally links the key to the newly created order for a 48-hour replay window. Concurrent retries return the same order and frozen amount/payment details without incrementing voucher usage or creating a second order; changed form values cannot mutate an already-created order. Replay issues a fresh order access token while retaining only the latest four previous token hashes, preventing an out-of-order network response from locking the customer out. PostgreSQL client rules explicitly deny access to the idempotency collection. No customer login or payment simulation was introduced.

Validation: typecheck, lint, 83/83 unit tests, i18n parity (26 sections), production build, catalog browser regression, and browser checkout smoke simulating a lost network response all passed. PostgreSQL rules emulator tests passed 8/8, including denial of client read/write to `guestOrderIdempotency`; Supabase CLI and rules-unit-testing were installed temporarily and the repository manifest/lockfile were not changed. Code commit `7136d5c6abed881039a5f6764f85c6bc52a63b49` was pushed to `main`.

## [Phase 8] 2026-11-02: durable guest abuse controls
- Added `lib/security/rate-limit.ts`, a server-transaction fixed-window limiter that hashes the authenticated logical scope and identity before storing counters under `rateLimits/{hash}`. No raw IP, email, WhatsApp number, edit token, or other contact data is persisted.
- Guest draft reads, draft saves, guest publication, and guest order creation now consume owner-scoped limits only after the edit token has been verified. Rejected requests return HTTP 429 with `Retry-After` and `retryAfterSeconds`.
- PostgreSQL client rules explicitly deny access to `rateLimits`; the limiter is durable in the same Store transaction as the protected operation and resets the existing counter after its window.
- Added unit coverage for window limits, owner isolation, and reset behavior, plus rules coverage for client denial.
- Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (84/84), `pnpm check:i18n`, and `pnpm build` passed. `pnpm test:rules` was not run because Supabase CLI and Rules Unit Testing dependencies are not present in the project manifest.
- Durable edit-link recovery remains blocked until an approved email/WhatsApp provider and trusted delivery/rate-limit configuration are available. Payment proof upload/preview remains blocked on Supabase Storage approval.


## [Phase 8] 2026-11-03: secure proof submission and emulator validation

Secure guest proof upload now authenticates the order token, validates JPG/PNG/WEBP/PDF size limits, writes through Supabase Admin Storage under an owner/order-scoped private path, and records metadata transactionally before allowing `proof_submitted`. Failed metadata commits clean up the object. Admins receive only a five-minute signed preview URL. Storage Rules tests, repeatable integration/rules scripts, project-local Supabase test dependencies, and explicit dev-editor route wiring were added. Validation passed: 85 unit tests, typecheck, lint, i18n parity, production build, PostgreSQL Rules 8/8, Storage Rules 2/2, PostgreSQL integration 1/1, catalog browser regression, and editor browser regression. Phase 8 remains open pending production Storage approval/configuration and an approved email/WhatsApp recovery provider; no payment or recovery delivery is simulated.


## [Phase 8] 2026-11-03: provider-neutral durable recovery foundation

Added hashed, domain-separated recovery tokens; server-only `guestEditRecoveries` records with 30-minute expiry and one-time redemption; atomic edit-token rotation; provider injection; destination-scoped durable rate limiting; and explicit client-deny PostgreSQL rules. The service fails closed when no approved delivery provider is configured and never persists email, WhatsApp, recovery URL, or edit-token plaintext. Added unit coverage; the suite now passes 88/88. Provider adapter, route/UI, and production delivery smoke remain intentionally unconfigured.


## [Supabase migration] 2026-11-03: initial PostgreSQL schema checkpoint

Added the first reproducible SQL migration for Bloomora's domain-oriented schema: admin profiles, packages, payment methods, vouchers, gifts/revisions, public gifts, slug reservations, analytics, orders, subscriptions/schedules, guest idempotency/recovery, rate limits, and admin audit logs. Added relational constraints and indexes, non-destructive default package seeds, RLS with only intended public SELECT access, and a private `payment-proofs` Storage bucket declaration. Guest owners remain synthetic identifiers with no customer Auth records. Validation: `pnpm test:unit` 88/88 passed; PostgreSQL parser accepted 45 statements; static checks covered all 16 expected tables. The migration was not applied to a Supabase/PostgreSQL instance; RLS, Storage, and runtime behavior remain unverified. Supabase remains active until later migration checkpoints.


## [Supabase migration] 2026-11-03: server client foundation

Added public Supabase URL/key, server-only service-role, and PostgreSQL URI environment helpers with validation; request-scoped cookie-aware `@supabase/ssr` client; server-only privileged Supabase client; and a pooled PostgreSQL driver factory for future atomic transactions. Added dependencies and safe empty placeholders in `.env.example`; no real credentials were used. Added unit coverage for missing/invalid/public/service-role/database configuration. Validation: typecheck, lint, build, i18n parity, and 89/89 unit tests passed. Supabase remains active; the new clients are not yet wired to runtime or business services. Next: implement and test the transactional PostgreSQL Store.


## [Supabase migration] 2026-11-03: PostgreSQL Store and PGlite integration

Added `postgresStore()` with explicit path/table and domain/column mappings, serializable transaction boundaries, bounded serialization/deadlock retries, and the existing all-reads-before-writes contract. Added PGlite tests that apply the migration with stub Supabase roles/schemas, check public/private RLS boundaries, and run guest checkout/idempotency, voucher limit, proof submission, approval, subscription linkage, and entitlement reads. `pnpm test:supabase` passes 2/2; unit suite 89/89; typecheck, lint, production build, and i18n pass. Runtime remains Supabase-backed and the Store is not wired; actual postgres-js/Supabase connection, transaction races, Auth/Storage/API cutover, and production verification remain pending.

## 2026-11-03 — Admin workspace redesign
- Separated admin routes visually from the customer site with a responsive SaaS-style sidebar and header.
- Added server-backed overview metrics, recent transactions, mobile navigation, and working Supabase logout.
- Redesigned admin login with password visibility toggle, loading/error states, and responsive composition.
- Added optional payment-method image upload, preview, replacement/removal controls, Storage validation, and checkout rendering.

## [Checkpoint] 2026-11-04: preview device dan payment order otomatis

Menambahkan toggle Mobile/Desktop pada editor preview. Toggle mempertahankan draft dan memakai renderer `GiftView` bersama, dengan viewport mobile berlebar smartphone dan viewport desktop fleksibel. Input angka Display Order dihapus dari form payment method; service menghitung urutan baru secara otomatis dalam transaksi dan tetap menjaga urutan saat edit. Validasi: typecheck, 89 unit test, i18n parity, lint (warning existing `<img>`), dan production build 40 route lulus.

## [Checkpoint] 2026-11-04: typed payment method details

Menambahkan field payment type, provider, nomor rekening/akun, pemilik akun, dan status konfirmasi QRIS pada admin payment method, service validation, serta PostgreSQL adapter. Migration database additive dipisahkan dan menunggu SQL manual.

## [Checkpoint] 2026-11-04: automatic payment method IDs

Admin form tidak lagi meminta method ID. ID internal dibuat server-side dan dipertahankan saat edit untuk menjaga referensi checkout serta snapshot transaksi.

## [Checkpoint] 2026-11-04: login dan admin navigation performance

Mengurangi query auth/profile berulang, menghapus refresh RSC kedua setelah login/logout, menonaktifkan prefetch massal menu admin, dan menambahkan loading boundary admin.

## [Hotfix] 2026-11-04: payment method save validation

Instruksi pembayaran kosong tidak lagi ditolak, dan mismatch kolom typed payment method kini dilaporkan dengan kode schema yang spesifik.


## [Fix] 2026-11-04: Payment Method Auth dan save diagnostics

Semua user dengan Auth session server-terverifikasi kini bisa mengelola Payment Method tanpa gate role `admin`; anon tetap tidak bisa menulis. Ditambah migration idempotent untuk RLS tabel dan Storage UID path, klasifikasi error database, pembersihan upload yatim pada kegagalan save, serta fixture PGlite yang menerapkan schema typed payment method. Status SQL live tetap menunggu eksekusi manual.


## [Fix] 2026-11-04: precise Payment Method schema error detection

Menghentikan klasifikasi semua PostgreSQL `42703`/PostgREST `PGRST204` sebagai `payment_method_schema_outdated`; kini pesan itu mensyaratkan tabel `payment_methods` dan kolom kontrak yang diketahui. Error tabel audit dibedakan. Ditambah `supabase/diagnostics/diagnose_payment_method_schema.sql` (SELECT-only); migration koreksi live menunggu output diagnosis, sehingga tidak ada SQL spekulatif.

Verifikasi: `pnpm test:unit` 92/92, `pnpm test:supabase` 2/2 (termasuk menjalankan diagnostic SQL di PGlite), typecheck, i18n, lint, dan production build 40/40 lulus. Tidak ada klaim test terhadap Supabase live.


## [Docs/SQL] 2026-11-04: consolidated manual migration bundle

Menambahkan `supabase/manual_apply_all_migrations.sql` dengan empat migration berurutan, guard constraint/policy supaya dapat diulang pada schema canonical, tanpa operasi DROP data. PGlite test menguji dua kali replay serta memastikan Payment Method/package data tetap. Script tidak melakukan auto-reconcile terhadap schema custom.


## [Security] 2026-11-04: explicit optional admin profile bootstrap

Bundle migration memiliki bootstrap profil opsional yang default skip; role hanya diberikan pada email yang cocok dengan satu Auth user yang sudah ada. Auth account/password tidak dibuat melalui SQL. Dokumentasi memperingatkan bahwa bundle schema bukan backup/restore.


## [Customer flow] 2026-11-04: custom public gift URL at checkout

- Checkout now loads the guest draft slug, lets the customer edit it before creating an order, normalizes spaces/case/unsupported characters, previews the final public URL, and checks availability through a server endpoint that requires the gift edit token and uses owner-scoped rate limiting.
- The order transaction reserves a changed slug and updates the draft gift slug atomically with order creation. A unique reservation collision returns `slug_unavailable`; an active/published gift or an order already awaiting payment/proof/approval locks the slug. Concurrent competition is covered by a unit test.
- Existing `gifts.slug` uniqueness and `slug_reservations.slug` primary key already enforce uniqueness, so this slice adds no database schema and creates no manual SQL. Previous random draft reservation records are retained as permanent non-public reservations under the existing policy; cancellation/release policy remains outstanding.
- Validation: `pnpm typecheck`, `pnpm check:i18n`, `pnpm test:unit` (93/93), `pnpm test:supabase` (3/3 PGlite tests), `pnpm lint`, and `pnpm build` (40 routes) passed. Lint/build report existing `<img>` warnings in payment-image rendering; no new error. Checkout browser E2E and live Supabase concurrency were not run.


## [Customer flow] 2026-11-04: private cross-device edit URL

- Added `/edit/{token}` as a noindex/no-referrer bearer route. The server hashes and resolves the token to one gift, verifies expiry/deletion, rate-limits valid owners, and passes the token to the editor; the raw token remains absent from database storage.
- The editor now offers a copy action with an explicit warning that anyone holding the private URL can modify the gift. Guest edit tokens are stored per gift in `sessionStorage` (with legacy fallback) so multiple drafts do not overwrite one another. The `edit` route is reserved from custom public slugs.
- PostgreSQL Store explicitly maps `editTokenHash` to `edit_token_hash` for exact token lookup. No schema change/manual SQL was needed. Validation: typecheck, 94/94 unit tests, 3/3 PGlite tests, i18n parity, lint and production build (40 static pages) passed. No browser E2E or production Supabase test was performed.


## [Customer flow] 2026-11-04: public gift stays recipient-only; verified-order success controls

- Removed QR/copy/share controls from the public gift page and deleted the old `PublicGiftActions` component. Public gift now renders the gift experience only.
- Added publication-aware success actions to the secure guest order detail: public link copy/open/share plus downloadable PNG/SVG QR appear only when the order is approved and the linked gift/public document are actually published. The same panel shows the private edit link separately when available in the current session. Approved-but-unpublished orders receive an honest instruction to publish in the editor; no false public link is shown.
- Extended secure order detail with only the published slug after token validation; no customer contact or edit-token data is exposed. QR copy is localized in Indonesian and English. No schema or SQL changed.
- Validation: typecheck, 94/94 unit tests, 3/3 PGlite tests, i18n parity, lint, and production build (40 static pages) passed. Browser end-to-end and live Supabase were not tested; local Node harness lacks installed esbuild/Playwright modules.


## [Customer flow] 2026-11-04: secure photo/audio uploads

- Added token-authorized `POST/GET /api/guest/gifts/{giftId}/media`. Files are checked for owner edit token, active package entitlement, quota, allowed MIME, byte signature and a 25 MiB maximum before/while server-side upload to private `gift-media`; draft refs, optimistic version and `gift_media` metadata commit transactionally. Failed metadata commits clean up the uploaded object.
- The editor now uploads photos/audio only for saved guest drafts, flushes pending autosave before upload, refreshes short-lived signed URLs, previews photos in the gallery and feeds audio to the existing player without autoplay. Published pages generate short-lived signed URLs server-side; no permanent public bucket URLs are used.
- `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED=true` is an explicit deployment opt-in. It must remain unset/false until the private bucket, existing customer-media migration, and server-only Supabase service-role configuration are ready. No live Storage was enabled and no new SQL migration was added.
- Validation: typecheck, lint, production build (40/40 routes), i18n parity (26 sections), unit tests (98/98), and PGlite tests (3/3) passed. Lint warnings are only existing `<img>` usages in payment-method/admin/checkout files. No real Supabase/Storage smoke test or browser upload E2E was run.


## [Admin/customer orders] 2026-11-04: soft-delete transaction records

- Added authenticated admin DELETE and owner-token DELETE for individual orders. Active/unexpired orders are not blocked by package/subscription expiry; repeat deletion is idempotent and invalid/cross-order guest tokens return not-found.
- Delete is a tombstone (`deleted_at`, `deleted_by_uid`), not cancellation or hard delete: payment/review state, order snapshots, proofs, voucher-use counters, gift, public gift, subscriptions, and historical approved revenue are preserved. Admin deletion writes `order.delete` audit history; active operational order/recent lists omit deleted records.
- Added the additive manual migration `20261104000400_order_soft_delete.sql` and incorporated it into the consolidated SQL bundle before its COMMIT. SQL is still owner-run; no live database was modified.
- Added confirmation and explicit soft-delete effect text to admin review and the secure owner order-detail page, with ID/EN copy for customers. No deletion action changes payment or gift status.
- Validation: typecheck, lint, unit 100/100, PGlite 3/3, and i18n parity 26 sections passed; production build is being rerun after the combined UI/backend update. PGlite validates local migration fixtures only, not Supabase live.


### Final combined validation follow-up — order soft-delete

The previously noted production-build rerun is complete: `pnpm typecheck`, 100/100 unit tests, 3/3 PGlite tests (including the corrected in-transaction five-file SQL bundle), 26-section i18n parity, lint, production build (40 routes), and `git diff --check` all passed. Lint warnings remain limited to existing `<img>` uses in payment-method/admin/checkout. Supabase live and browser E2E were not run.


## [Customer checkout] 2026-11-04: require one contact channel, not two

- Checkout groups contact details and clearly marks email and WhatsApp as optional individually; at least one must be supplied. Email/phone format errors are shown beside the grouped contact fields, and form values remain in state after failure.
- Server validation matches the UI: accepts email-only or WhatsApp-only, stores the unused nullable field as `null`, and rejects an order when neither is supplied. Added a regression test for all three paths. No schema migration was needed because contact columns were already nullable.
- Validation: typecheck, unit tests (101/101), i18n parity (26 sections), lint, production build (40 routes), and `git diff --check` passed. PGlite was last run immediately before this schema-free change (3/3); browser E2E/live Supabase were not run.


## [Security] 2026-11-05: restrict payment destinations to admins/owners

The management API/service and QR/payment image upload/delete now require a verified admin/owner profile; ordinary authenticated accounts are denied. Added `20261105000100_payment_method_admin_only.sql`, replacing broad authenticated RLS policies on `payment_methods` and `payment-method-images` with admin/owner role checks. Storage object operations are additionally scoped to the caller's own UID folder. Active payment methods remain publicly readable for checkout, and the existing public image bucket remains readable as configured. PGlite verifies non-admin read/write boundaries, admin access, path scoping, and repeatable consolidated bundle. This is local schema validation only; the migration still needs operator execution on Supabase.


Validation follow-up: typecheck, unit 101/101, PGlite 3/3, i18n 26 sections, lint, production build (40 routes), and `git diff --check` passed. Only existing image optimization warnings remain; live Supabase was not changed or tested.


## [Customer payments] 2026-11-05: freeze QR/account details on order

Guest order snapshots now include payment type, provider/account holder/account number, and the QR image URL/path available at checkout; the token-protected order detail returns a safe subset without customer contact data. The order page renders the frozen QR for QRIS and frozen recipient details for transfer methods, alongside the final server-calculated order amount and localized instruction to pay exactly that amount. Replaced QR files are retained because earlier orders may reference them; there is not yet reference-counted cleanup. No DB migration is required because the existing JSON payment-method snapshot column accommodates optional fields. Regression tests verify snapshot and final amount persist across admin edits. Validation: typecheck, unit 101/101, i18n 26 sections, lint and production build passed; PGlite schema was unchanged. Live Supabase/browser payment flow was not tested.


## 2026-11-05: ekspansi katalog Bloomora, batch 1–5

- Menambahkan 40 konfigurasi gift baru dalam lima batch: anniversary/long-distance, Valentine, apology keluarga/pasangan/sahabat, delapan gaya wedding, birthday, friendship, Ramadan/Eid/Christmas/New Year/Lunar New Year, graduation/first-generation, family appreciation, engagement, bridal shower, gender reveal, farewell/moving-away, dan special announcement; seluruhnya memakai sample Indonesia/Inggris serta registry/engine yang sama untuk katalog, detail, editor, preview, checkout/publish, dan gift publik.
- Menambahkan kategori bilingual untuk Romantic & Love, Birthday & Celebration, Apology & Appreciation, Family & Friendship, Graduation & Achievement, Special Moments, dan Holiday & Seasonal; mempertahankan kategori lama dan satu Featured Demo.
- Menambahkan petal reveal ringan dan opsional pada tema terpilih, dengan dukungan `prefers-reduced-motion` serta tanpa dependency aset/library baru.
- Petal reveal opsional tersedia di 15 desain, menjaga reduced motion dan tanpa menambah dependency. Total: 44 template aktif, yakni 4 existing + 40 baru.
- Validasi final: typecheck, lint (warning `no-img-element` existing), 102/102 unit test, check:i18n (26 section), production build (40 routes), dan `git diff --check` lulus. Browser catalog/mobile belum tervalidasi karena Playwright tidak tersedia di dependency sesi ini.

## 2026-11-05: responsive composition seluruh template
- Mengetatkan spacing, tinggi hero/closing, timeline, gallery, card deck, music player, lightbox, dan touch target pada breakpoint 859/520/360px.
- Menambahkan penyesuaian mobile spesifik untuk art-directed hero/gallery tanpa menyamakan desain seluruh template atau menghilangkan konten.
- Menjaga lazy media, reduced motion, urutan section, rasio foto, dan no-horizontal-overflow behavior.
- Static browser harness mendapat shim `process.env` agar `next/image` dapat diuji di luar Next runtime.
- Validasi: typecheck, lint, unit 103/103, build 40 route, diff check, browser smoke 117/119. Dua assertion SSR fixture existing gagal; catalog/editor harness masih memiliki batasan BUILD_ID/localization yang dicatat di PROGRESS/HANDOVER.


## 2026-11-05: custom slug lifecycle fix

- Memperbaiki availability slug agar tidak lagi menyamakan semua reservation dengan konflik permanen; status published, order aktif, cancelled/rejected, deleted, dan unpaid expiry kini dibedakan oleh server.
- Menambahkan reclaim atomik untuk draft/testing stale dan unpaid checkout setelah 48 jam. Gift lama dipindah ke generated slug baru sehingga unique constraint tetap aman.
- Menambahkan kolom lifecycle reservation (`expires_at`, `order_id`), report SQL read-only, serta regresi untuk draft stale dan unpaid hold.
- Validasi: typecheck lulus, unit test 105/105 lulus, dan `git diff --check` lulus. Migration belum diterapkan ke Supabase production.

## [Checkpoint] 2026-11-05: checkout diagnostics and voucher apply
- Added server-side voucher preview at `/api/guest/vouchers/validate`; it verifies the guest edit token and server package price without reserving usage.
- Checkout applies vouchers on Enter or Apply, displays discount/total, clears stale vouchers when the package changes, and submits only the validated code.
- Unexpected order exceptions now produce bounded `[guest-order-create]` server logs and stable `order_create_failed` responses instead of an opaque generic 500.
- Fixed the Supabase integration harness to load `20261105000100_slug_reservation_lifecycle.sql`. The reproduced failure was `column "expires_at" of relation "slug_reservations" does not exist`, which explains the generic order error when production SQL is missing that migration.

## 2026-11-06: guest media sebelum checkout dan validasi limit paket

Guest dengan edit-token valid sekarang dapat mengunggah foto/audio ke bucket private sebelum memilih atau membayar paket. Subscription tidak lagi menjadi gate upload; autentikasi bearer edit-token, validasi MIME/magic bytes, ukuran 25 MiB, signed URL, optimistic version, dan cleanup object tetap berlaku. Autosave, reload draft, dan publish mempertahankan referensi media privat yang sah, sementara batas jumlah foto dan entitlement musik dipindahkan ke server-side checkout. UI checkout men-disable paket yang tidak memenuhi limit dan menjelaskan alasannya.

Validasi checkpoint: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, dan `pnpm test:unit` (105/105) lulus. Supabase live, Storage production, dan browser device smoke belum dijalankan.

## 2026-11-06: Tahap 2 checkout, QRIS, dan hardening proof

Checkout kini hanya menampilkan pilihan metode pembayaran yang ringkas: radio selection, nama metode, dan thumbnail kecil. QRIS besar, detail rekening, dan instruksi lengkap baru tampil setelah order dibuat pada halaman detail order. Detail order juga menyediakan unduhan gambar QRIS asli tanpa mengubah payload atau quiet zone.

Route upload bukti pembayaran kini memeriksa magic bytes JPG, PNG, WEBP, dan PDF selain MIME, ukuran maksimum, order token, private Storage path, hash deduplikasi, dan status transition. Validasi checkpoint: i18n parity, typecheck, lint, dan unit test 106/106 lulus. Supabase live/Storage production dan browser device smoke belum dijalankan.

## 2026-11-06: copy proof upload

Pesan pelanggan pada detail order tidak lagi menyatakan upload bukti selalu unavailable. Copy sekarang menjelaskan bahwa file disimpan privat, diperiksa manual, dan pengiriman bukti bukan konfirmasi pembayaran. I18n parity 26 sections lulus.


## 2026-11-06: guest photo deletion and QRIS display settings

- Memperbaiki hapus foto guest dengan memindahkan seluruh pembacaan metadata/reference sebelum transaksi menulis. Edit-token, optimistic version, soft-delete metadata, dan reference-counted Storage cleanup tetap dipertahankan.
- Menambahkan editor QRIS di halaman payment methods admin dengan live preview, warna, judul, instruksi, frame, dekorasi luar, dan footer. QR asli tidak digambar ulang atau ditutupi.
- Menambahkan tabel `qris_display_settings`, endpoint admin-only, validasi config, adapter PostgreSQL, migration Supabase, dan bundle manual SQL.
- Checkout membekukan desain QRIS ke payment snapshot; perubahan admin tidak mengubah order lama.
- Validasi: typecheck, lint, media regression 6/6, order/payment/QRIS regression 11/11. Supabase live, browser E2E, dan pemindaian QRIS perangkat nyata masih perlu dilakukan setelah migration diterapkan.


## 2026-11-09 — Between the Pages scrapbook template

Menambahkan template scrapbook editorial baru dengan registry config-driven, sample Bahasa Indonesia/Inggris, art direction modern scrapbook, editor-compatible fields/lists, dan renderer bersama untuk demo/preview/public. Reader memiliki cover personal, YOU camera shutter, camera permission flow, retake/confirm, upload fallback, recipient-only photo state, double-page spreads, timeline, personal letter, hidden message, music player, ending page, responsive mobile behavior, dan keyboard-friendly navigation controls. Existing templates, landing page, dan persistence model tidak diganti.
