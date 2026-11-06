# Keputusan bisnis dan teknis

Setiap butir diberi status: DISEPAKATI (pengguna menyatakannya), DIIMPLEMENTASIKAN (ada di kode), TERTUNDA, atau DIVERGENSI (keputusan dan kode berbeda). Dokumen ini tidak mengubah kode; divergensi harus diselesaikan dengan persetujuan pengguna.

## Status business rules dan asumsi terbuka

1. **Stacking perpanjangan.** Kebijakan disepakati: renewal menumpuk sisa masa aktif. DIIMPLEMENTASIKAN pada `b8766d2`: `approveOrder` membaca expiry active terjauh, memulai periode berikutnya di sana, dan memperbarui per-owner server-only `subscriptionSchedules` ledger agar approval paralel diserialkan. Fake Store concurrency test lulus; PostgreSQL emulator/rules belum dijalankan di sandbox.
2. **Batas gift per subscription.** Belum ada keputusan. KODE SEMENTARA menerapkan `maxGifts: 1` per subscription (disalin dari teks halaman harga "1 gift"), dihitung lewat `createdUnderSubscriptionId` termasuk gift yang sudah dihapus. Ini asumsi sementara, bukan keputusan. Bila diputuskan tidak ada batas, ubah nilai di `lib/packages.ts` dan tes terkait.

## Keputusan

| # | Keputusan | Status |
|---|---|---|
| 1 | **Model B**: paket mengatur hak membuat, mengedit, dan memublikasikan. Paket TIDAK mengatur umur gift yang sudah terbit. Gift terbit tetap bisa dibuka publik tanpa batas waktu setelah paket pemilik habis | DISEPAKATI. DIIMPLEMENTASIKAN (`lib/entitlements.ts`, `lib/server/services.ts`, rules, tes). Fungsi visibilitas publik hanya menerima status dokumen publik, bukan subscription |
| 2 | Pembayaran manual QRIS dengan verifikasi admin. Subscription hanya lahir dari persetujuan admin atas order yang bukti bayarnya sudah diajukan | DISEPAKATI. SEBAGIAN: order, proof-gated `approveOrder`/`rejectOrder`, admin order detail/audit scaffold, admin sales, dan CRUD metode aktif sudah ada. Pengajuan bukti dan secure preview masih menunggu Storage |
| 3 | Setelah subscription habis: tidak bisa membuat, mengedit, memublikasikan, atau memulihkan arsip. Tetap bisa melihat, menyalin link, mengarsipkan, dan menghapus gift sendiri | DISEPAKATI. DIIMPLEMENTASIKAN |
| 4 | Perpanjangan menumpuk sisa masa aktif | DISEPAKATI. DIIMPLEMENTASIKAN di `planSubscriptionActivation` dan `approveOrder`; dites dengan approval paralel |
| 5 | Template: satu Featured Demo saja (`chapter-of-us`), bukan 10 demo. Template lain tampil sebagai katalog biasa tanpa demo palsu. Tier `core` dan `extended` menentukan paket mana yang boleh memakai. Featured Demo bertier `core` agar semua paket bisa memakainya | DISEPAKATI. DIIMPLEMENTASIKAN |
| 6 | Versi template tidak pernah diedit. Perubahan field atau layout = entri baru `version + 1`. Gift menyimpan versi yang dipakainya. Template nonaktif hilang dari katalog tetapi gift lama tetap render dan bisa diedit | DIIMPLEMENTASIKAN |
| 7 | Data privat `gifts` dipisah dari `publicGifts/{slug}` yang hanya ditulis server dan tidak memuat uid pemilik, order, atau subscription | DISEPAKATI. DIIMPLEMENTASIKAN (tipe, service, rules) |
| 8 | Draft tidak boleh menimpa versi terbit sebelum republish. Menyimpan draft hanya menyentuh `gifts`. Publish memakai `expectedVersion` (yang dipratinjau), membuat revisi immutable, lalu menulis `publicGifts` | DISEPAKATI. DIIMPLEMENTASIKAN |
| 9 | Arsip menyembunyikan gift publik (status `archived`) dan bisa dipulihkan pemilik selama paket aktif. Hapus bersifat soft: `publicGifts` menjadi `removed` dengan konten dikosongkan, slug tetap dicadangkan selamanya, draft dan revisi privat dipertahankan (penghapusan permanen adalah langkah eksplisit di masa depan). Pencabutan oleh admin (`removed`) tidak bisa dibatalkan pemilik lewat publish ulang | DISEPAKATI. DIIMPLEMENTASIKAN. Alat moderasi admin belum ada |
| 10 | Slug 12 karakter acak (CSPRNG, alfabet 31 simbol), tidak memuat uid, dialokasikan saat gift dibuat dan tidak berubah | DIIMPLEMENTASIKAN |
| 11 | Supabase belum terhubung. Pengembangan memakai interface `Store` dan Fake Store untuk uji logika. Tidak ada localStorage atau file lokal sebagai pengganti database | DISEPAKATI. DIIMPLEMENTASIKAN |
| 12 | Tidak boleh mengaktifkan Supabase Storage production atau billing tanpa persetujuan eksplisit | DISEPAKATI |
| 13 | Upload bukti bayar ditunda sampai Supabase Storage siap | DISEPAKATI. TERTUNDA. Opsi menyimpan bukti kecil di PostgreSQL pernah diusulkan dan tidak dipilih |
| 14 | Upload gambar/audio hanya melalui server setelah pemeriksaan owner token, entitlement, tipe, ukuran, kuota, dan signature; objek berada di bucket privat, signed URL berumur pendek. Tidak ada penulisan Storage langsung dari klien. Fitur harus opt-in per deployment dan Storage production tidak diaktifkan tanpa persetujuan eksplisit | DISEPAKATI. KODE DIIMPLEMENTASIKAN; MENUNGGU MIGRATION/ENV/SMOKE SUPABASE |
| 15 | Tanpa emoji atau glyph mirip emoji di desain. Ilustrasi adalah SVG original, bukan foto, sampai ada foto berlisensi | DISEPAKATI. Ditegakkan oleh gerbang `validate-config.ts` dan tes browser |
| 16 | Hormati `prefers-reduced-motion`. Template dapat memilih `motion: 'none'` | DISEPAKATI. DIIMPLEMENTASIKAN dan diuji |
| 17 | Font memakai system stack (tanpa dependency atau request jaringan) | DIIMPLEMENTASIKAN. Dapat diubah ke `next/font` |
| 18 | Harga dan durasi paket: Basic Rp19.000/3 hari, Plus Rp39.000/14 hari, Premium Rp69.000/30 hari. Konstanta di `lib/packages.ts` mencerminkan halaman harga dan menjadi seed. Koleksi PostgreSQL `packages` menjadi sumber otoritatif pada implementasi Supabase lama; target database mengikuti keputusan #31 | Implementasi Supabase historis; target Supabase tercatat di #31 |
| 19 | Tidak ada dependency baru ditambahkan. Dev tooling harness (esbuild, playwright, @supabase/rules-unit-testing, supabase-tools) belum ada di `package.json` agar lockfile pnpm tetap sinkron untuk Vercel | Kebijakan historis; superseded oleh keputusan #33 |
| 20 | `lib/engine/registry.ts` adalah satu-satunya sumber template aktif untuk UI. Kartu/detail/preview berasal dari `TemplateConfig`; status demo, tier, dan kategori tidak diduplikasi dalam registry kedua. Eligibilitas paket hanya informatif sampai backend memeriksa entitlement | DIIMPLEMENTASIKAN (Phase 4; registry legacy dihapus) |
| 21 | Prefiks locale URL (`/id/`, `/en/`) mengalahkan cookie bahasa lama pada request yang sama agar server render konsisten saat berpindah bahasa | DIIMPLEMENTASIKAN di middleware dan diuji browser (Phase 4) |
| 22 | GET draft editor mengizinkan pemilik melihat gift privat setelah entitlement berakhir (read-only); setiap save tetap melalui service entitlement dan expectedVersion. Konflik versi perlu reload eksplisit, bukan retry otomatis | DIIMPLEMENTASIKAN dan diuji (Phase 5) |
| 23 | Tanpa Supabase, sandbox editor hanya untuk development lokal eksplisit (`NODE_ENV=development` + `BLOOMORA_DEV_EDITOR=true`), menggunakan memori proses yang volatil dan peringatan yang terlihat; mode ini tidak tersedia pada production | DIIMPLEMENTASIKAN dan diuji browser (Phase 5) |
| 24 | ID gift tersimpan tidak berbagi namespace dengan slug template: editor baru di `/editor/new?template=...`, gift di `/editor/g/[giftId]`; path lama `/editor/[giftId]` tetap sebagai alias kompatibilitas | DIIMPLEMENTASIKAN (Phase 5) |

## Catatan terkait temuan lama

- Header lama (`components/language-switcher.tsx`) memakai emoji bendera. Itu di luar area desain baru dan belum diubah.
- Chip kategori `/templates` kini memakai filter kategori dari `CATEGORIES` (Phase 4); hanya status aktif dari registry engine yang ditampilkan.
- Teks FAQ, `/expiration`, dan `plan.md` lama masih menyiratkan gift kedaluwarsa. Bertentangan dengan Model B dan harus ditulis ulang di fase UI.

## Business flow update — keputusan baru

25. Customer tidak wajib memiliki akun. Draft guest memakai secure edit token yang dibuat CSPRNG; hanya hash token yang disimpan. Login tetap menjadi jalur admin/akun legacy, bukan prasyarat customer.
26. Public slug dapat dipilih customer, tetapi hanya setelah normalisasi, reserved-name validation, dan atomic reservation server-side. Slug publik tidak boleh berisi edit token.
27. Voucher dan metode pembayaran adalah konfigurasi server. Harga akhir, diskon, masa berlaku voucher, usage limit, dan status pembayaran tidak boleh dipercaya dari browser.
28. QR designer hanya mengubah presentasi QR yang mengarah ke public URL. Edit URL/token tidak boleh masuk QR.
29. Recovery link melalui email/Resend belum diaktifkan sampai provider credential dan rate-limit storage tersedia; sistem tidak boleh menampilkan secure edit URL tanpa verifikasi kepemilikan.


## 27. Authentication boundary — 2026-11-02

Customer authentication is not part of the Bloomora purchase flow. Customers may browse templates, create and edit drafts, preview gifts, and continue toward checkout without registering or logging in. Draft ownership uses a server-generated high-entropy edit token; only its hash is stored by the service. Administrative authentication is separate and restricted to `/admin/login` and `/admin/*`; session creation requires the verified Supabase `admin: true` custom claim. This boundary must not be weakened by reintroducing customer login gates in UI or API routes.


## 30. Tahap 8 blockers and unresolved implementation items — 2026-11-02

The following are not implementation-complete: payment-proof storage/submission and secure file preview, durable secure edit recovery, trusted rate limiting/abuse controls, Storage rules, and PostgreSQL adapter/integration tests. PostgreSQL rules emulator suite passed 8/8 on 2026-11-02 using temporary Supabase CLI/Rules Unit Testing packages matching the project SDK; the dependencies remain absent from the project manifest/lockfile, so the repeatable project-local runner is still pending. Payment-method/package/voucher CRUD, secure guest order details, proof-gated admin review, subscription stacking, guest approval-to-publication linkage, and 48-hour guest order idempotency are implemented; latest code checkpoint `7136d5c6abed881039a5f6764f85c6bc52a63b49`. Storage and paid providers require explicit configuration/approval.


## Supabase migration decisions — 2026-11-03

29. **Backend target is Supabase/PostgreSQL, replacing Supabase fully.** AUTHORITY: user-provided migration brief. Implementation is in progress; Supabase remains the active runtime until all replacement paths and tests pass. Do not run Supabase and Supabase as indefinite dual production backends.
30. **Customers remain guests; only provisioned owner/admin users may use Supabase Auth.** Guest ownership IDs remain opaque synthetic strings and are not foreign keys to `auth.users`. Public sign-up must be disabled; no customer password/session/account is created.
31. **PostgreSQL schema is domain-oriented and reproducible via committed SQL migrations.** Initial schema checkpoint is `supabase/migrations/20261103000100_initial_schema.sql`. The schema and Store service paths currently pass PGlite tests, but the adapter is not wired and is not verified against the production network driver/Supabase. Domain writes must use real PostgreSQL transactions or atomic SQL/RPC operations; multi-request REST read-then-write is not acceptable for race-sensitive business operations.
32. **RLS and privacy boundary:** private application tables deny direct anon/authenticated access; only active package/payment method rows and published presentation-safe gifts are client-readable. Private proofs use the private `payment-proofs` bucket; guest uploads and admin previews are mediated by server authorization. Service-role keys remain server-only.

These decisions describe the target design. They do not certify that Auth, RLS, Storage, transaction execution, or cutover has been implemented or tested; current runtime is still Supabase-backed.

33. **Migration dependencies are authorized and scoped.** Add `@supabase/ssr`, `@supabase/supabase-js`, `postgres`, `server-only`, and the dev-only `@electric-sql/pglite` test engine for the user-authorized migration. This supersedes historical decision #19. No live project secrets are committed.


## Transaction deletion policy — 2026-11-04

Penghapusan order biasa adalah soft-delete/tombstone yang dicatat dengan waktu dan actor; tidak mengubah state pembayaran/review, menghapus proof/gift/public gift/subscription/voucher history, atau menghilangkan approved revenue dari histori keuangan. Admin memakai session Auth `admin: true`; pemilik guest dibuktikan oleh order access token karena customer login memang tidak tersedia (keputusan #27). Tombstone menyembunyikan order dari daftar operasional/recent; administrator mempertahankan audit trail. Skema memerlukan migration manual `20261104000400_order_soft_delete.sql`, belum diterapkan di Supabase live.


## Checkout contact minimization — 2026-11-04

Checkout hanya mewajibkan satu kanal kontak pelanggan (email atau WhatsApp); kanal lain tidak diwajibkan. Server memvalidasi value yang diberikan dan menolak keduanya kosong. Ini mempertahankan model guest tanpa membuat akun; kedua kolom database tetap nullable, tanpa migration.


## Payment destination administration boundary — 2026-11-05

Payment methods (bank details, wallet details, QRIS images) are privileged payment destinations and can only be managed by provisioned `admin`/`owner` profiles. Existing broad authenticated-user policies are replaced by migration `20261105000100_payment_method_admin_only.sql`; the server APIs apply the same check, and storage image writes are UID-folder scoped. Public checkout retains active-method reads only. Live SQL must be applied manually before deployment.


## Locale, domain resmi, dan notifikasi chat — 2026-11-06

35. **Bahasa antarmuka.** Seluruh UI Bloomora hanya Bahasa Indonesia; tidak ada language switcher, cookie preferensi bahasa, atau preferensi bahasa server. Route `/id/...` dan `/en/...` tetap diterima sementara sebagai redirect kompatibilitas ke route tanpa prefix; cookie `bloomora_locale` legacy dibersihkan. Copy data lama dapat tetap tersimpan untuk kompatibilitas engine, tetapi tidak mengaktifkan UI English. Status: DISEPAKATI pengguna; DIIMPLEMENTASIKAN.
36. **Origin resmi.** URL canonical dan tautan publik memakai `https://bloomora.my.id`, bukan host preview atau Vercel. `NEXT_PUBLIC_SITE_URL` hanya diterima bila persis cocok dengan origin resmi; selain itu helper fallback ke domain resmi. Status: DISEPAKATI pengguna; kode DIIMPLEMENTASIKAN. Inspeksi Vercel read-only awal menemukan variabel belum ada dan apex redirect 308 ke `www.bloomora.my.id`. Pengguna kemudian melaporkan aturan domain Vercel telah diubah agar apex dipakai; dashboard dan status environment variable tidak diperiksa ulang setelah laporan itu, dan tidak ada perubahan project Vercel oleh agent.
37. **Bunyi balasan chatbot.** Mainkan bunyi pendek dan lembut hanya setelah balasan baru berhasil selesai, maksimum satu kali per jawaban; jangan bunyikan saat error atau memuat riwayat. Autoplay tidak dipaksa: suara default mati dan pengguna dapat mengaktifkannya lewat interaksi di UI, dengan mute yang disimpan lokal tanpa cookie. Status: DISEPAKATI pengguna; DIIMPLEMENTASIKAN.

## QRIS and homepage CTA — 2026-11-06

38. **QRIS aktif hanya dari crop yang dikonfirmasi.** Upload gambar sumber boleh mengandung identitas merchant, tetapi sumber mentah tidak pernah menjadi QRIS aktif. Server mendeteksi/crop hanya QR dan quiet zone, memvalidasi format/payload/CRC, membaca ulang hasil crop, dan membandingkan payload dengan sumber; kegagalan harus diblokir dengan opsi crop manual, bukan fallback ke gambar penuh. Preview admin dan customer harus memakai renderer visual yang sama; desain disnapshot pada order. Status: DISEPAKATI pengguna; DIIMPLEMENTASIKAN.
39. **CTA pembuatan hadiah memulai dari katalog.** Tombol “Buat hadiah” desktop/mobile di header serta CTA template utama pada homepage menuju `https://bloomora.my.id/templates` secara eksplisit (apex, tanpa `www`) sebelum pengguna membuat hadiah. Status: DISEPAKATI pengguna; DIIMPLEMENTASIKAN.
