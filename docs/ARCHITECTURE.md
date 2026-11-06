# Arsitektur Bloomora

## Stack (dari `package.json`)

Next.js 15 (App Router), React 19, TypeScript 5.8, Tailwind CSS 3.4, @supabase/ssr and @supabase/supabase-js with server-side PostgreSQL, zod, react-hook-form, framer-motion, lucide-react, qrcode.react, @google/genai (chatbot). Paket manager pnpm 10. Deploy target: Vercel. Supabase is the configured application backend; production Storage provisioning remains environment-specific.

## Struktur folder penting

```
app/                     route Next (halaman, API)
  demo/chapter-of-us/    Featured Demo (server component memanggil GiftView)
  api/gifts, api/orders, api/admin/orders   route tipis ke service
components/gift/         renderer bersama (client)
components/              komponen situs lama + chrome-gate, featured-demo-band, demo-language-toggle
lib/model/               tipe skema v2, validasi konten, planner migrasi
lib/engine/              template engine (tipe, registry, resolve, interaction, plates, tema)
lib/engine/templates/    konfigurasi template (data)
lib/entitlements.ts      aturan akses murni (tanpa I/O dan tanpa jam)
lib/server/              service transaksional, interface Store, adapter PostgreSQL, helper HTTP
lib/packages.ts          seed paket     lib/slug.ts   lib/features.ts
supabase/                rules dan indeks (belum dideploy)
messages/                en.json dan id.json (namespace gift dan featuredDemo ditambah)
tests/unit, tests/browser, tests/rules
docs/
```

Sejak Phase 4, `lib/engine/registry.ts` adalah sumber tunggal daftar template aktif untuk katalog, homepage, detail, create, preview editor, fallback demo, dan konteks chatbot. Registry lama `lib/templates.ts`, tes sinkronisasinya, serta kunci pesan nama/deskripsi per-slug telah dihapus. UI mengambil nama, deskripsi, kategori, section, tier, status demo, dan sample dari `TemplateConfig`.

## Alur data dan service

```
browser -> route handler (lib/server/http.ts: cek origin, sesi, claim admin dari token terverifikasi)
        -> lib/server/services.ts (satu transaksi per operasi, jam server)
        -> interface Store (lib/server/store.ts)
              produksi: postgres-store.ts (Admin SDK)      uji: Fake Store + sandbox memori development eksplisit
```

- Semua tulis ke PostgreSQL melalui server. Rules menolak semua tulis dari client.
- Service membaca subscription pengguna, memanggil fungsi murni di `lib/entitlements.ts`, lalu menulis. Identitas selalu dari sesi, bukan dari body request.
- `ServiceError` menjadi respons `{ ok:false, code }`. Kode editor dipetakan ke teks dua bahasa; konflik 409 tidak di-retry secara buta.
- Fake Store meniru aturan PostgreSQL (semua baca sebelum tulis, `create` gagal bila ada, rollback atomik).

## Entitlement dan subscription

Subscription dibuat hanya oleh `approveOrder` (admin, order `proof_submitted`, id `sub_<orderId>` lewat `create()` sehingga idempoten). "Kedaluwarsa" diturunkan dari `expiresAt` terhadap jam server, tidak disimpan. Paket yang dibeli dibekukan di `packageSnapshot`. Lihat `docs/data-model.md` untuk tabel koleksi dan matriks izin, dan `docs/DECISIONS.md` untuk divergensi (stacking, kuota).

## Draft dan revisi terbit

`gifts/{id}.draft` (konten + `version`) hanya diubah `saveDraft` dengan `expectedVersion`. `publishGift` memvalidasi terhadap versi template yang dipin, menolak konten tidak lengkap, membuat `gifts/{id}/revisions/{n}` immutable, dan menulis `publicGifts/{slug}`. Menyimpan draft tidak pernah menyentuh `publicGifts`.

## Template engine (Phase 2)

Template adalah data: tema (palet, token font, motion), section berurut (tipe + varian), field dan list yang bisa diedit, dan konten contoh dua bahasa. `resolveRenderModel(config, content, { fillEmptyFrom })` menghasilkan apa yang digambar: section opsional yang dimatikan, section tanpa konten, dan section audio tanpa audio dilewati. `fillEmptyFrom` hanya untuk demo dan pratinjau, TIDAK PERNAH untuk gift asli. Konten disimpan berdasarkan key stabil sehingga revisi layout tidak menimpa teks pengguna. Gerbang kualitas `validateTemplateConfig` wajib lulus untuk setiap template. Detail: `docs/template-engine.md`.

## React renderer dan Featured Demo (Phase 3)

- `GiftView` (pintu masuk tunggal) -> `resolveRenderModel` -> `GiftExperience`. Mode: `demo` (sample, pembuka tersegel), `public` (konten asli, tanpa isian contoh), `preview` (terbenam di editor, pembuka dilewati, scroll di dalam kontainernya sendiri).
- Perilaku interaksi (pembuka, lightbox, dek kartu, swipe, bab aktif, progres) ada di reducer murni `lib/engine/interaction.ts`; komponen hanya mengirim aksi.
- Gaya hanya dari token `--bl-*` (`theme-vars.ts`) di `gift.css`, tanpa Tailwind, sehingga dapat diuji di luar Next.
- Plate galeri adalah data SVG (`plates.ts`), dirender dengan warna tema. Gambar gagal dimuat tidak mungkin: tidak ada `<img>`.
- Hanya varian yang dikenal renderer (`IMPLEMENTED_VARIANTS`) yang dirender; varian lain jatuh ke varian default tipenya. Template dengan demo wajib memakai varian yang diimplementasikan (ada tesnya).
- `ChromeGate` menyembunyikan header, footer, chatbot di `/demo/*`. Rute demo: hanya `chapter-of-us`.
- Konten pengguna dirender sebagai teks (React escaping). Ada tes bahwa markup tampil literal dan tidak dieksekusi.
- Musik: bagian dirender hanya bila ada audio DAN `audioSrc` terselesaikan; tidak pernah autoplay.

## Publishing dan public gift (Phase 6)

- `getPublicGift` adalah read path server-only yang hanya mengambil `publicGifts/{slug}` setelah `isValidSlug`; fungsi ini tidak memanggil `loadEntitlement` dan tidak membaca `gifts`, `subscriptions`, atau `orders`.
- `/g/[giftSlug]` memilih `getTemplateForRender(templateId, templateVersion)` dari dokumen publik, lalu merender `GiftView mode="public"` dengan konten revisi yang tersimpan. `fillEmptyFrom` hanya aktif pada preview/demo, tidak pada public gift.
- Status `published` dirender sebagai pengalaman penerima immersive. `archived`, `removed`, slug invalid, dokumen hilang, dan server belum terkonfigurasi dirender sebagai status card; state nonpublik diberi `noindex` melalui `generateMetadata`.
- Editor publish memakai `expectedVersion` dari draft yang sudah tersimpan. Salin link, Web Share/fallback, dan QR hanya berada di detail order sukses yang terautentikasi token setelah publikasi; public gift tetap recipient-only. Media privat menggunakan signed URL server berumur pendek; upload hanya muncul bila `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED=true` dan konfigurasi storage server tersedia.

## Analytics, Insights & Export (Phase 7)

- `giftAnalytics/{slug}` adalah aggregate server-only: total view, first/last viewed timestamp, dan bucket harian. Tidak ada visitor identity, cookie analytics, atau client-side write.
- Public page memanggil `recordPublicGiftView` hanya setelah `getPublicGift` menemukan gift `published`; function membaca `publicGifts` dan aggregate lalu menulis kembali melalui `Store` transaction. Subscription tidak pernah dibaca dari public path.
- `getDashboardData` melakukan query owner-scoped untuk gifts, subscriptions, dan orders, lalu menggabungkan statistik serta insight. Draft content tidak dikirim ke dashboard.
- `/api/dashboard/export` mengharuskan session owner dan menghasilkan JSON atau CSV dari gift milik user, termasuk draft content hanya pada response download yang private/no-store. Supabase rules tetap default-deny untuk analytics karena seluruh akses melewati server.

## Katalog dan detail template (Phase 4)

- `components/templates-page.tsx` menggunakan `searchCatalog` dan `CATEGORIES`; pencarian mencakup konten id/en, filter kategori aktif, hasil kosong/reset, serta state pemulihan error. `app/templates/loading.tsx` dan `error.tsx` menyediakan boundary route.
- `components/template-art.tsx` menyusun preview SVG/CSS tanpa aset eksternal dari palet, varian section, dan sample masing-masing template. Preview bukan gift demo dan tidak mengklaim interaksi penerima.
- `app/templates/[slug]/page.tsx` menerima hanya template aktif dari `getActiveTemplate`, menampilkan sections dan paket yang `allowedTemplateTiers`-nya mencakup tier. Ini informasi; pemeriksaan entitlement tetap di service/server saat alur berikutnya.
- `/create?template=<id>` mempertahankan pilihan engine; Featured Demo tetap satu (`chapter-of-us`) dan tautan demo kartu muncul hanya bila `hasDemo`.
- Middleware menyetel locale prefiks pada request yang sedang dirender serta cookie response agar render pertama `/en/...` tidak mewarisi locale lama.

## Editor dan draft (Phase 5)

- `/editor/new?template=<id>` memulai editor atas template aktif; `/editor/g/<giftId>` mengedit draft dengan ID tersimpan. `/editor/[giftId]` adalah alias lama untuk slug template, sedangkan `/editor/demo` mengarah ke demo nyata.
- `components/gift-editor.tsx` membangun field/list/section dari `TemplateConfig`, dan menampilkan `GiftView mode="preview"` dengan sample hanya untuk field kosong. Kontrol section hanya mengubah bagian opsional dalam urutan config; foto dan audio tetap disabled karena `MEDIA_UPLOAD_ENABLED=false`.
- `GET /api/gifts/[giftId]` mengembalikan draft hanya setelah pemeriksaan pemilik. Expired/archived draft dapat dibaca sesuai kebijakan, tetapi API menandai `editable=false`; penulisan tetap lewat `saveDraft` dan pemeriksaan entitlement.
- Autosave di `lib/editor/autosave.ts` debounce, single-flight, mengirim `expectedVersion`, dan berhenti pada konflik. Pemilik memilih reload server untuk rekonsiliasi; perubahan lokal dipertahankan saat kegagalan/expiry.
- `lib/server/dev-editor-env.ts` menyediakan adapter volatile khusus test/dev yang hanya aktif jika `NODE_ENV=development` dan `BLOOMORA_DEV_EDITOR=true`. State process-global dibutuhkan lintas bundle route Next; tidak ada localStorage/file, dan fungsi menolak production.
- Auth return path menggunakan `safeInternalRedirect`; middleware mempertahankan query string pada rewrite locale agar `template` tetap ada setelah `/id` atau `/en` dihapus untuk routing internal.
- Browser test `pnpm test:editor` meliputi create, autosave+reload, konflik 409, expiry, media disabled dan id/en; `pnpm test:catalog` menjaga regresi katalog.

## Rencana integrasi Supabase dan status validasi

1. Setelah aplikasi selesai: buat konfigurasi env (lihat README), deploy `postgres.rules` dan `postgres.indexes.json`, seed koleksi `packages`.
2. Jalankan `pnpm test:rules`, `pnpm test:storage-rules`, dan `pnpm test:integration` di emulator; ketiga suite kini tersedia sebagai script project.
3. Verifikasi `postgres-store.ts` terhadap emulator; guest-commerce integration test kini menjalankan adapter PostgreSQL asli.
4. Ganti bagian UI yang masih statis dengan data nyata lewat route server.
5. Setelah persetujuan production provisioning: provisikan Storage production dan jalankan smoke upload/preview non-produksi; proof upload server-side sudah tersedia, sementara media gift umum tetap menunggu entitlement dan pipeline publish.
6. Uji keamanan, lalu deployment.

## Batas mock dan produksi

| Bagian | Kondisi |
|---|---|
| Logika entitlement, service, validasi, engine, renderer | Nyata dan diuji (Fake Store, browser) |
| Adapter PostgreSQL Admin, route handler, `runtime.ts` | Ditulis, BELUM pernah dijalankan dengan Supabase atau dikompilasi Next |
| Rules PostgreSQL/Storage | Diuji di emulator: PostgreSQL 8/8 dan Storage 2/2 |
| Auth sesi (`lib/session.ts`) | Kode lama, bergantung Supabase, belum diuji di sini |
| Pembayaran | Guest order, frozen payment details, order-detail access token, server-side proof upload, private signed preview, admin detail/audit, proof-gated approve/reject, subscription stacking, dan guest order-to-publish linkage tersedia. Pembayaran sungguhan belum terhubung |
| Editor, dashboard, halaman publik `/g/[slug]`, admin | Editor/draft dan admin sales/payment/package/voucher/order-review flows menggunakan service; `/g/[slug]` masih placeholder dan belum memakai service publik |
| Upload media | Implementasi server-only opt-in tersedia; live Supabase Storage belum diuji atau diaktifkan |

## Business flow update — guest customer

Customer tidak lagi diwajibkan membuat akun. Draft guest dibuat melalui `app/api/guest/gifts`, lalu server mengembalikan edit token satu kali bersama gift id dan public slug. Token dibuat dengan CSPRNG, hanya hash SHA-256 yang disimpan pada `gifts/{id}`, dan request edit berikutnya wajib mengirimkannya melalui header `x-bloomora-edit-token`. Token tidak pernah masuk ke `publicGifts`, QR code, analytics, atau public URL.

Custom slug dinormalisasi dan divalidasi server-side sebelum reservasi atomik di `slugs/{slug}`. Reserved route names ditolak dan URL yang sudah dipakai tidak dapat direbut kembali.

`lib/commerce.ts` menjadi kontrak murni untuk voucher persentase atau nominal, periode aktif, usage limit, minimum transaksi, serta payment method aktif. Harga final harus dihitung ulang di server; UI tidak boleh menjadi sumber kebenaran harga, diskon, atau status pembayaran.

## Guest order approval dan publication (Phase 8)

Guest checkout menyimpan `giftId` privat di `orders/{orderId}`. Saat admin menyetujui order yang memiliki gift, service dalam transaksi yang sama memastikan pemilik gift sama dengan `order.userId`, membuat subscription berurutan melalui schedule ledger, dan mengaitkan draft yang belum pernah terbit ke `createdUnderSubscriptionId`. Order level akun tanpa `giftId` tetap dapat memakai alur subscription lama. Pelanggan tidak perlu login.

`GET /api/guest/gifts/{giftId}` menghitung publish readiness dari token edit dan subscription slot terkait; draft belum terbit tidak dapat menggunakan subscription lain yang kebetulan aktif. `POST /api/guest/gifts/{giftId}/publish` memerlukan edit token, subscription slot aktif, versi draft yang cocok, validasi template/konten, lalu menulis revision dan `publicGifts/{slug}` secara atomik. Publish adalah tindakan eksplisit customer setelah approval, bukan otomatis saat pembayaran disetujui. Order-detail endpoint hanya mengembalikan gift link di balik order access token; CTA kembali ke editor muncul setelah order approved.

Upload bukti pembayaran/preview tersedia melalui route server-side, tetapi production bucket tetap harus disiapkan dan disetujui; approval tetap proof-gated dan tidak boleh disimulasikan. PostgreSQL Rules 8/8, Storage Rules 2/2, dan PostgreSQL integration 1/1 telah lulus melalui script project. Durable edit recovery masih menunggu provider email/WhatsApp yang disetujui.

Checkout guest memakai idempotency key acak 256-bit yang disimpan di `sessionStorage` sampai server mengembalikan sukses. Server menscope key terhadap synthetic guest owner, menyimpan hanya SHA-256 pada `guestOrderIdempotency/{hash}`, lalu secara transaksional menautkannya ke order selama jendela replay 48 jam. Retry atas intent yang sama mengembalikan order lama tanpa mengulangi reservasi voucher, terlepas dari perubahan data form setelah permintaan pertama. Replay menerbitkan token akses order baru; hanya hash token aktif dan sampai empat hash sebelumnya dipertahankan agar respons jaringan paralel tidak membatalkan token yang sah. Collection idempotency ditolak eksplisit oleh PostgreSQL client rules. Rate limiting durable kini memakai bucket fixed-window yang di-hash dan owner-scoped; durable edit recovery masih menunggu provider delivery yang disetujui.

QR designer pada `components/qr-designer.tsx` hanya menerima URL halaman publik yang sedang dibuka. Ia menyediakan warna titik/latar dan export PNG/SVG, serta tidak memiliki akses ke edit token.


## Authentication boundary update — 2026-11-02

The public customer path is guest-first. `/editor/new`, `/editor/g/[giftId]`, and `/checkout` do not require a customer session. Draft editing uses `/api/guest/gifts` and a CSPRNG edit token whose hash alone is persisted. `/admin/login` is the only login entry point exposed by the product, and `/api/auth/session` rejects tokens without the verified admin custom claim. Checkout and public method listing remain available without login; all configuration writes and transaction administration require admin authorization.


## Phase 8 unfinished boundaries — 2026-11-02

Guest order creation and admin sales are implemented. Payment methods are managed through admin-only `/api/admin/payment-methods` and `/admin/payment-methods`; public `/api/payment-methods` returns active methods only and `createGuestOrder` rechecks the chosen method in its transaction. Packages are managed through admin-only `/api/admin/packages` and `/admin/packages`; active definitions feed pricing, template eligibility/detail, Featured Demo, and checkout. Vouchers are managed through admin-only `/api/admin/vouchers` and `/admin/vouchers`; definitions are validated server-side and `createGuestOrder` rechecks eligibility, computes discount, increments `usedCount`, and creates the order in one transaction. Voucher delete is a soft-delete to preserve order references. Package, payment-method, and voucher writes create admin audit records. Orders freeze package terms and payment-method instructions at creation. Guest detail access uses a random token returned once to the checkout browser; only its SHA-256 hash is stored on the order. `/api/guest/orders/{orderId}` verifies that token, returns amount/status/instructions without customer email or phone, and uses private no-store caching. The order id alone is never authorization.

The complete payment state machine is not yet implemented: proof submission and Storage-backed private media/preview, and approval-to-gift publication orchestration remain unfinished. Admin detail is `/admin/orders/{orderId}` and `/api/admin/orders/{orderId}` is admin-claim protected; it returns contact/payment/order metadata, audit actions and rejection reason, never raw storage paths. `approveOrder` and `rejectOrder` require `proof_submitted` plus valid proof metadata; reject reasons are audited. `approveOrder` is the only subscription creation boundary and now stacks each approved period after the furthest unexpired active subscription. It reads and updates `subscriptionSchedules/{encodedUserId}` in the same transaction to serialize simultaneous approvals; PostgreSQL rules deny all client access to this ledger. Voucher usage is reserved at order creation; order detail does not imply proof/payment success. Preserve separation between public gifts, private guest edit-token access, customer contact data, and admin-only transaction/proof data.

## Durable abuse controls (Phase 8)
Jalur guest yang memakai edit token memanggil `consumeRateLimit` setelah token dan gift owner tervalidasi. Counter disimpan sebagai hash pada koleksi server-only `rateLimits`, dan ditulis dalam transaksi yang sama dengan operasi guest. Fixed windows memakai satu dokumen per scope/owner agar tidak menumbuhkan dokumen tanpa batas; counter di-reset setelah `resetAtMs`. Tidak ada IP header yang dipercaya dan tidak ada data kontak/token plaintext yang disimpan di counter. Rate limit bukan pengganti durable edit recovery; recovery tetap memerlukan provider pengiriman terverifikasi.


## Secure payment proof boundary (Phase 8)

Guest proof upload is a server-only Storage operation. The order access token is verified before upload, the owner UID and order ID determine the private path, and MIME/size limits are enforced before Supabase Admin Storage writes. The order transaction records only path metadata and changes status to `proof_submitted`; if that transaction fails, the uploaded object is removed. Admin preview resolves the path only after admin authorization and returns a five-minute signed URL. PostgreSQL and Storage client rules deny direct client writes. Production behavior remains disabled until the Supabase Storage bucket and billing configuration are explicitly approved.


## Durable guest edit recovery boundary (Phase 8)

Recovery is split into a provider-neutral transactional core and an external delivery adapter. `issueGuestEditRecovery` compares a supplied destination with the private gift contact, stores only a hash of that destination, creates a pending one-time record, and marks it `sent` only after the injected provider accepts the URL. `redeemGuestEditRecovery` checks the server-side expiry and status, rotates `gifts/{giftId}.editTokenHash`, and marks the recovery record redeemed in one transaction. Recovery records are server-only and client PostgreSQL access is denied. Until an approved provider is configured, the service fails closed and no recovery URL is emitted.


## Supabase target architecture — migration in progress (2026-11-03)

The target backend is Supabase PostgreSQL, Supabase Auth for provisioned owner/admin accounts only, and private Supabase Storage for payment proofs. Customers remain anonymous guests using the existing high-entropy edit/order capabilities; their synthetic owner IDs do not map to `auth.users`. The first reproducible database schema is `supabase/migrations/20261103000100_initial_schema.sql` and is described in `docs/SUPABASE_MIGRATION.md`.

Important status boundary: the existing production adapter, Auth session, APIs, and proof Storage code are still Supabase-backed. The schema has been applied to the PGlite test engine with stub Supabase roles/schemas and basic anon/authenticated RLS checks; `lib/server/postgres-store.ts` has service-flow integration coverage but is not wired into runtime. No live Supabase project, actual postgres-js connection, Storage object policy, or production transaction race has been tested. Supabase must not be removed until PostgreSQL/pooler connectivity, Auth session handling, API/Storage replacements, concurrency tests, and a rollback-safe cutover are verified. Use real PostgreSQL transactions or single atomic SQL/RPC operations for business rules that currently rely on PostgreSQL transactions; separate PostgREST calls do not provide the required transaction boundary.


## Private customer media uploads (2026-11-04)

`app/api/guest/gifts/[giftId]/media/route.ts` accepts multipart uploads only through the guest edit-token service boundary. `lib/server/media-services.ts` validates file kind, allowlisted MIME plus byte signature, 25 MiB size, draft version, subscription entitlement, and package quota before committing content references and `gift_media` metadata. Supabase Storage admin credentials stay server-only. The private bucket yields 15-minute signed URLs for owner preview and published public gifts. `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED` is a deployment opt-in; do not enable it until the existing media migration, private bucket, DB and server secret are available. Supabase live configuration remains unverified.


## Order soft deletion

`orders.deleted_at` and `deleted_by_uid` are tombstone fields. Admin deletion is authenticated/audited; guest owner deletion checks the order access-token hash and fails closed as not-found for invalid or cross-order tokens. Neither path cascades into proof, gift, public gift, subscription, voucher usage, payment status, or historical financial totals. Add the columns with `20261104000400_order_soft_delete.sql` before deployment; the app does not infer that live SQL was applied.


## Payment destination authorization

All payment-method configuration (including merchant accounts and QR images) is limited to server-verified admin/owner actors. RLS uses `admin_profiles`; payment-method image Storage policies also require an admin/owner role and the caller's UID path. Checkout can still read active payment methods; customer roles cannot mutate destinations. Apply migration `20261105000100_payment_method_admin_only.sql` before deploying this change.
