# Supabase migration status and operator notes

Updated: 2026-11-03. This document is the current handover for the authorized Supabase-to-Supabase migration. The legacy Supabase implementation remains the active runtime until each replacement is implemented and verified; this checkpoint does not claim a completed backend cutover.

## Checkpoint 1: PostgreSQL schema foundation

Added `supabase/migrations/20261103000100_initial_schema.sql`. It defines domain-oriented PostgreSQL tables for admin profiles, packages, payment methods, vouchers, private gifts, immutable gift revisions, public gift presentations, permanent slug reservations, aggregate gift analytics, orders, subscriptions, per-owner subscription schedules, guest-order idempotency, guest-edit recovery, rate limits, and admin audit logs.

The migration preserves opaque text IDs and synthetic guest owner IDs; guest IDs are not foreign keys to `auth.users`. It carries existing package snapshots, order/contact state, token hashes, proof metadata, content JSON, and timestamps into typed relational columns plus narrowly scoped JSONB values. It seeds the current Basic/Plus/Premium terms only when the package ID is absent, so rerunning the seed does not overwrite admin-managed values.

RLS is enabled on every application table. Direct client access is denied by default except read-only access to active packages, active payment methods, the caller's own admin profile, and published presentation-safe public gifts. There are no client write policies. The migration creates a private `payment-proofs` Storage bucket with a 5 MiB cap and allowlisted content types; guests must upload through a server route after order-token validation, and there are no anon/authenticated object policies. Server-side authorization remains mandatory.

## Verification for this checkpoint

- The current migration parses as 46 PostgreSQL statements and applies successfully in the PGlite PostgreSQL/WASM test engine. The test bootstraps stub `auth`/`storage` schemas and roles; it is not a live Supabase project or a separately installed PostgreSQL server.
- `pnpm test:supabase` passes 2/2 integration tests: package seeds and the private bucket declaration; anon/authenticated RLS boundaries; plus the Store-backed guest gift, rate limit, checkout, voucher usage limit, proof submission, admin approval, subscription ledger, and guest entitlement read path.
- Current checks: typecheck, lint, production build, i18n parity, and `pnpm test:unit` (89/89) pass. The adapter integration uses a PGlite compatibility wrapper, not the production `postgres` network driver; serialization races and actual pooler connectivity remain unverified.
- No live Supabase project or credentials are available. Auth cookie/session behavior, actual Storage upload/download and policies, production PostgreSQL, service-role containment in deployed routes, and production cutover are not tested. Supabase remains the active runtime.

## Security and business invariants to preserve

- Customers remain guests; only owner/admin identities may exist in Supabase Auth. Never create a customer `auth.users` record or link synthetic guest owner IDs to Auth.
- Supabase service-role secrets must remain server-only. The client may use only public keys and the intentionally public SELECT policies.
- `public_gifts` contains presentation content only, without owner/contact/order/subscription/token data. Draft and payment data remain private.
- Preserve transaction atomicity and concurrency safety for order idempotency, voucher usage limits, the open-order cap, reserved slugs, draft version checks, publishing, proof submission, review, and stacked subscription approval. A sequence of separate Supabase REST requests is not a PostgreSQL transaction.
- Payment remains QRIS. Gemini extracts receipt evidence; deterministic order-snapshot checks gate the optional high-confidence auto-approval path, while every uncertain or duplicate case stays in manual admin review. This is not bank settlement confirmation.
- Recovery tokens and edit/order access tokens are stored as hashes; recovery delivery remains disabled until an approved provider and trusted origin are configured.

## Remaining implementation checkpoints

1. Wire `postgresStore()` and the PostgreSQL client factory into runtime only after testing against an actual PostgreSQL/Supabase instance and reviewing connection-pooler compatibility; add serialization/concurrency tests for voucher caps, idempotency, slugs, draft versions, and subscription stacking.
2. Migrate admin-only Supabase Auth: verified server sessions, role checks via server-controlled `admin_profiles`, public signup disabled, out-of-band owner provisioning, and removal of customer signup/login UI while guests remain account-free.
3. Migrate all APIs and services, public reads, dashboard/export, private proof Storage upload/preview, recovery, and abuse controls. Test each route, RLS boundary, server-only secret path, storage authorization, and browser flow.
4. Configure and verify an owner-controlled Supabase project, canonical origin, Vercel secrets, owner/admin identity, private bucket, and migration execution. No real project credentials were available in this checkpoint.
5. Backfill only if an actual Supabase production dataset exists and the owner explicitly authorizes it; compare records and privacy boundaries before cutover. No production data was accessed or changed.
6. Remove Supabase code, rules, dependencies, and setup docs only after parity, production tests, and a rollback-safe cutover have been verified. Update README, `.env.example`, architecture, roadmap, progress, decisions, and handover then.

## Owner configuration still required

No credentials are invented or included. Before connecting to a real Supabase project, the owner will need to provide/configure the project URL and publishable/anon key, a server-only privileged key (or an alternative least-privilege server setup), a secure database connection method for transaction support, the canonical site URL, owner/admin account provisioning, and appropriate Vercel environment settings. Do not place any of these values in Git.


## Checkpoint 2: server client foundation

Added environment validation for the public Supabase URL/key, server-only service-role key, and PostgreSQL URI; a request-scoped cookie-aware SSR client; a privileged server-only client; and a small pooled PostgreSQL client factory. `.env.example` documents empty Supabase target placeholders while retaining Supabase settings for the active runtime. Fake-value env validation tests pass. No real credentials were used, and these clients are not wired into runtime.

## Checkpoint 3: PostgreSQL Store and PGlite integration

Added `lib/server/postgres-store.ts` with explicit collection/path/key and domain-column mappings, compatibility timestamps, queued writes, strict read-before-write behavior, SERIALIZABLE transactions, and bounded retry for PostgreSQL serialization/deadlock errors. The migration was adjusted to satisfy current service document shapes and transaction write order.

`pnpm test:supabase` applies the schema to an isolated PGlite PostgreSQL/WASM database with minimal stub Supabase Auth/Storage schemas and anon/authenticated roles. It checks the seed rows, private bucket declaration, public-only published gift reads, denied private-table/client writes, and an integration path for guest gift creation, rates, checkout/idempotency, one-use voucher, proof submission, admin approval, subscription schedule/linkage, and entitlement reads. It passes 2/2. `pnpm test:unit` is 89/89; typecheck/lint/build/i18n pass.

This does **not** validate a real Supabase service, the production `postgres` network driver or Supavisor pooler, real transaction concurrency/race behavior, Storage object permissions/uploads, Auth cookies/session refresh, or endpoint/browser migration. The adapter remains unused by runtime; Supabase is still the active backend.

## Remaining work (next agent/operator)

1. Run the production driver against an owner-configured PostgreSQL/Supabase transaction pooler; verify schema apply, connection behavior and SQL parameter serialization. Add concurrent race tests for voucher usage, order idempotency, slug uniqueness, draft versions and per-owner subscription stacking.
2. Only after those checks, connect `postgresStore()` via `getServerEnv()` and migrate the remaining service environment and timestamps without breaking guest token flows.
3. Migrate admin-only Auth/session validation and role checks, keep public sign-up disabled, and remove customer account flows.
4. Migrate every server route/service and public read; move proof upload/preview to private Supabase Storage with server authorization and Storage policy tests; migrate recovery and rate limiting.
5. Run endpoint, isolation, browser, RLS, Storage and security suites; obtain an owner-approved rollback/backfill plan. Never backfill without an actual dataset and explicit authorization. Do not delete Supabase code or claim cutover until production parity is verified.

Required owner configuration for live validation: project URL and anon/publishable key; server-only privileged key or approved least-privilege alternative; PostgreSQL transaction/session-pooler URI and connection settings; canonical site URL and Vercel environment; owner/admin Auth provisioning with public signup disabled. Do not commit secrets.

## Checkpoint 4: opt-in runtime provider wiring (2026-11-03)

`getServerEnv()` now supports `Supabase database configuration`: it creates the pooled PostgreSQL client and `postgresStore()` with server-owned time and IDs. Supabase remains the default for backwards compatibility, and Supabase is never selected merely because partial environment variables happen to exist. If the explicit Supabase provider is selected without a valid `SUPABASE_DB_URL`, routes continue to fail closed with the existing unavailable-backend response rather than silently writing to Supabase.

This is provider wiring only. No live Supabase credentials or database were available in this checkpoint, so the production driver, pooler, Auth, Storage, route parity, and concurrency requirements remain unverified. Keep `Supabase database configuration` until those checks pass.

## Checkpoint 5: storage preparation for customer media (2026-11-04)

Added `supabase/migrations/20261104000100_customer_media_storage.sql` and the operator-friendly `supabase/setup_storage.sql`. The setup keeps `payment-method-images` public for admin-managed QRIS/account images, keeps `payment-proofs` private for manual payment review, and adds a private `gift-media` bucket for customer JPEG/PNG/WEBP photos and MPEG/MP4/OGG/WAV/M4A audio. The `gift_media` table stores only owner/gift-scoped metadata and a private Storage path; RLS denies direct anon/authenticated table access.

This checkpoint prepares Storage but does **not** claim that customer media upload/editor wiring or public signed-media delivery is complete. The service-role key must remain server-only, and the customer-media bucket must not receive direct browser policies. Apply the migration only in the owner-controlled Supabase project, then run a non-production upload/preview smoke after the corresponding server routes are enabled.


## Checkpoint 6: Payment Method schema, Auth, dan RLS (2026-11-04)

Audit menemukan adapter selalu mengirim kolom typed payment method; schema initial tidak memilikinya, sehingga project yang belum menerapkan `20261104000200_payment_method_details.sql` akan menolak save. Status project Supabase live tidak tersedia dari checkout ini dan tidak diklaim sudah diperbaiki. Dokumen operasional lengkap ada di `docs/SUPABASE_MANUAL_SQL.md`.

Migration `20261104000300_payment_method_authenticated_management.sql` mengganti policy tabel Payment Method secara eksplisit: SELECT publik terbatas pada metode aktif, semua sesi `authenticated` dapat membaca/mengelola metode, dan anon/public tidak mendapat privilege tulis. Policy Storage bucket `payment-method-images` hanya mengizinkan sesi terautentikasi pada folder UID sendiri; bucket tetap public-read untuk Checkout. Aplikasi juga menggunakan sesi Auth terverifikasi pada server tanpa tambahan role admin khusus untuk fitur Payment Method. SQL hanya disimpan di repo dan belum dijalankan ke Supabase live.

PGlite menerapkan migration berurutan dan memverifikasi active-only anon read, authenticated management, anon write denial, path Storage per-UID, QRIS tanpa nomor rekening, serta flow Store: `pnpm test:supabase` 2/2. Tetap perlu menjalankan SQL manual dan browser/Auth/Storage smoke pada project non-production.


## Checkpoint 7: re-diagnosis persistent Payment Method save error (2026-11-04)

Tidak tersedia konfigurasi Supabase project pada workspace, sehingga schema live belum diperiksa. Pemeriksaan kode menemukan `payment_method_schema_outdated` sebelumnya terlalu luas: semua `42703`/`PGRST204`, atau pesan yang menyebut typed column, diberi kode itu tanpa memastikan table/column; transaksi Save juga menulis `admin_audit_logs`. Klasifikasi kini mensyaratkan tabel dan kolom kontrak yang spesifik, dan audit schema failure dibedakan.

`supabase/diagnostics/diagnose_payment_method_schema.sql` adalah script SELECT-only untuk membandingkan schema expected/actual, audit log table, constraints, RLS/grants, Storage bucket/policies, dan migration-history availability. Jalankan ini dahulu di project live dan kirim output sebelum membuat migration koreksi. Tidak dibuat migration fix baru karena akan bersifat spekulatif; tidak ada SQL yang dijalankan ke Supabase oleh agent.


## Checkpoint 8: consolidated manual replay bundle (2026-11-04)

`supabase/manual_apply_all_migrations.sql` menggabungkan lima file migration berurutan: initial schema ditambah empat migration tertanggal 2026-11-04, termasuk `20261104000400_order_soft_delete.sql`. Constraint dan policy awal diberi guard untuk menjalankan bundle ulang pada schema Bloomora canonical; tidak menghapus table/column/data dan tidak menulis payment methods. PGlite menjalankan bundle dua kali pada data existing dan memverifikasi metode, harga package, policy serta tombstone order.

Bundle tidak memperbaiki tipe/default/constraint arbitrary pada schema custom dan tidak menulis Supabase CLI migration history. Untuk incident live, jalankan `supabase/diagnostics/diagnose_payment_method_schema.sql` terlebih dahulu jika ingin mengetahui kondisi aktual; bundle adalah opsi operator untuk replay semua SQL canonical. Tidak ada SQL dijalankan ke project live.


## Checkpoint 9: explicit optional admin profile bootstrap (2026-11-04)

Bundle menjalankan admin-profile seed hanya jika `bloomora.admin_email` diatur: email harus cocok tepat satu user `auth.users` yang sudah dibuat melalui Supabase Dashboard, lalu role `admin` ditautkan di `public.admin_profiles`. Default kosong/no-op. Tidak ada password/Auth user yang dibuat atau dimasukkan SQL.

Bundle hanya membuat schema dan seed package, bukan backup/restore. Reset database penuh juga menghapus Auth users serta customer/payment data; lakukan backup/restore dan Auth provisioning di Dashboard sebelum reset/cutover.


## Checkpoint: payment-method role policy hardening (2026-11-05)

Migration `20261105000100_payment_method_admin_only.sql` supersedes the broad authenticated-user payment-method management policy from migration `20261104000300`. Apply it after migration 003 (or replay the consolidated manual SQL bundle on the canonical schema) before deploying the code. It preserves method data and public active-method reads while limiting management and image object operations to provisioned admins/owners. It has passed local PGlite policy tests; no Supabase project has been changed or smoke-tested.

## Checkpoint: smart payment proof review and QRIS image processing (2026-11-05)

Migration `20261105000200_payment_proof_ai_review.sql` adds admin-only JSONB proof-analysis metadata and private SHA-256 claim tables for uploaded proof files and normalized transaction references. Identical proof bytes cannot be attached to a different order; a transaction reference also cannot receive two automatic approvals. Apply this migration manually, or run the updated `supabase/manual_apply_all_migrations.sql`; the app does not assume the live database has been changed.

After storage-backed proof submission, Gemini reads amount, recipient, account number, payment date, and transaction reference. The server computes its own order-snapshot comparisons. Auto-approval requires confidence ≥98%, an exact order amount, exact normalized recipient, a visible payment date/reference, and exact account number whenever the snapshot has one; duplicate references and all missing/uncertain fields remain for admin review. The admin retains approve/reject controls and can inspect the AI extraction and MATCH/MISMATCH/needs-review markers. The model does not verify bank settlement; no confidence score can make a fabricated screenshot trustworthy, so manual preview remains important.

Admin QRIS uploads are server-processed into cropped, white-padded, square 1024px WebP artwork for consistent checkout display. The actual order continues to use its frozen package/payment snapshot. `sharp` is a production dependency; verify serverless native-binary deployment and image previews in the owner-controlled Vercel/Supabase environment. No live SQL, Storage, or deployment action was performed.
