# Supabase manual SQL — Payment Method

**Tidak ada SQL yang dijalankan terhadap project Supabase Anda oleh perubahan ini.** Semua migration di bawah disimpan di repository dan harus dijalankan oleh pemilik melalui Supabase Dashboard → **SQL Editor**. Jalankan setiap file utuh dalam urutan berikut, hanya jika file tersebut belum pernah berhasil diterapkan:

**Jangan hapus/reset database hanya untuk memperbaiki Save.** Bundle lengkap membuat schema dan paket default, tetapi tidak memulihkan user Auth, profil admin lama, metode pembayaran, order, gift, subscription, atau data project lainnya. Ekspor/backup dan uji rencana restore sebelum operasi reset apa pun.

**Untuk incident saat ini (Save masih mengembalikan `payment_method_schema_outdated` setelah SQL dilaporkan sudah dijalankan), jangan menjalankan migration lain dulu.** Jalankan hanya file read-only [`supabase/diagnostics/diagnose_payment_method_schema.sql`](../supabase/diagnostics/diagnose_payment_method_schema.sql) di SQL Editor. Koneksi project tidak tersedia pada workspace ini, jadi schema live belum diperiksa. Kirim hasil semua result grid (file diagnosis tidak membaca isi rekening/payment dan tidak mengubah apa pun); jangan kirim credential, token, service-role key, atau data transaksi. Berdasarkan output itu baru tentukan apakah migration 002 perlu diperbaiki/diulang atau terdapat masalah berbeda pada `admin_audit_logs`, RLS, atau Storage.

Jika Anda memang perlu menerapkan bundle lengkap, gunakan file [`supabase/manual_apply_all_migrations.sql`](../supabase/manual_apply_all_migrations.sql). File itu menggabungkan tujuh migration berurutan: initial schema, customer media/storage, typed payment details, authenticated Payment Method management, order soft-delete, admin/owner-only Payment Method management, dan AI payment-proof review/claims. Bundle sudah diuji replay pada PGlite. Ia tidak menghapus tabel, kolom, atau baris, tetapi policy bernama yang dikelola migration akan di-drop/recreate. Jalankan **file gabungan itu saja**, bukan sekaligus file gabungan dan file migration individual.

Bundle memiliki bootstrap profil admin opsional yang default-nya dilewati. Untuk mengaktifkannya, buat/invite dulu user di **Supabase Dashboard → Authentication → Users**, lalu ganti email kosong pada `set local bloomora.admin_email = '';` dengan email persis milik user tersebut. Bagian itu hanya menambahkan role `admin` pada `public.admin_profiles` untuk satu user Auth yang sudah ada; tidak membuat login, tidak memasukkan baris ke `auth.users`, dan tidak mengatur password. Jangan menaruh password atau service-role key di SQL/repository. Jika akun Auth sudah ikut terhapus, buat ulang user lewat Supabase Auth terlebih dahulu, baru jalankan bundle.

Catatan penting: `CREATE TABLE IF NOT EXISTS` dan `ADD COLUMN IF NOT EXISTS` tidak dapat memperbaiki tipe/default/constraint yang salah pada tabel custom atau schema yang hanya sebagian terbentuk. Bundle ini juga tidak memperbarui Supabase CLI migration history. Karena Anda sudah melaporkan SQL pernah dijalankan, diagnosis read-only tetap langkah yang paling tepat sebelum replay; jangan jalankan file gabungan jika ingin memeriksa dahulu penyebab database yang aktual.

1. `supabase/migrations/20261103000100_initial_schema.sql` — schema awal.
2. `supabase/migrations/20261104000100_customer_media_storage.sql` — bucket/media customer.
3. `supabase/migrations/20261104000200_payment_method_details.sql` — tipe dan detail payment method.
4. `supabase/migrations/20261104000300_payment_method_authenticated_management.sql` — akses Payment Method untuk sesi Auth terverifikasi.
5. `supabase/migrations/20261104000400_order_soft_delete.sql` — kolom tombstone order.
6. `supabase/migrations/20261105000100_payment_method_admin_only.sql` — membatasi pengelolaan Payment Method ke admin/owner.
7. `supabase/migrations/20261105000200_payment_proof_ai_review.sql` — metadata AI review opsional dan tabel claim private.

Jika schema sudah pernah diterapkan, jangan langsung replay seluruh bundle untuk mengatasi error. Jalankan diagnosis read-only terlebih dahulu dan pastikan server menunjuk ke project yang sama. `IF NOT EXISTS` tidak memperbaiki tipe kolom/constraint custom, dan replay tidak memperbarui migration history Supabase CLI. Bila tetap perlu menjalankan bundle pada schema canonical, backup dulu lalu jalankan file gabungan utuh satu kali; jangan jalankan file migration individual bersamaan.

## Pemeriksaan sebelum menjalankan

Untuk inspeksi ringkas, gunakan file diagnosis read-only di atas. Query di bawah adalah pemeriksaan ringkas untuk penerapan migration yang akan datang. Migration detail harus menambahkan lima kolom typed-payment; jika belum ada, jalankan file nomor 3 sebelum nomor 4. Pada incident yang masih gagal, jangan asumsikan kolom itulah penyebab sampai hasil query menunjukkan kolom mana yang hilang atau berbeda.

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payment_methods'
order by ordinal_position;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'payment_methods'
order by policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'payment-method-images';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

Migration permission secara eksplisit mengganti semua policy pada `public.payment_methods` agar kebijakan lama yang bertentangan tidak tetap berlaku. Untuk Storage, migration menambahkan policy bernama `payment_method_images_authenticated_*`; periksa query di atas untuk menemukan policy Storage lama yang memberi akses tulis luas ke bucket ini. Jangan mempertahankan policy `anon`/`public` untuk menulis. Policy Storage aplikasi membatasi unggah/perubahan/penghapusan langsung ke path `payment-methods/<auth.uid()>/...`; bucket tetap **public read** agar checkout dapat menampilkan gambar.

## Verifikasi setelah migration

Kolom typed-payment dan policy baru harus tersedia:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'payment_methods'
  and column_name in ('payment_type', 'provider_name', 'account_number', 'account_holder', 'qris_detection_status')
order by column_name;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'payment_methods'
order by policyname;

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'payment_method_images_authenticated_%'
order by policyname;
```

Hasil kolom pertama harus memuat lima nama. Untuk `public.payment_methods`, policy tulis hanya ditujukan ke `authenticated`; tidak boleh ada grant atau policy INSERT/UPDATE/DELETE untuk `anon`/`public`. Untuk Storage, empat policy terautentikasi (SELECT, INSERT, UPDATE, DELETE) harus ada dan dibatasi ke folder UID pemanggil; bucket `payment-method-images` tetap public, batas ukuran 5 MiB, MIME `image/jpeg`, `image/png`, dan `image/webp`.

Setelah SQL berhasil diterapkan, uji melalui `/admin/payment-methods`: login dengan sesi yang sah, simpan Bank Transfer dengan nama provider, nomor rekening, dan pemilik; simpan e-wallet dengan provider dan nomor akun; simpan QRIS tanpa nomor rekening; simpan metode dengan instruksi kosong; lalu uji edit/nonaktif. Pastikan hanya metode aktif muncul pada Checkout. Gambar merupakan upload terpisah dan tetap opsional. Status QRIS `needs_confirmation`/`confirmed` adalah status administrasi, bukan verifikasi pembayaran otomatis.

Jika Save mengembalikan `payment_method_schema_outdated`, migration nomor 3 belum berlaku pada database yang dipakai server atau `SUPABASE_DB_URL` menunjuk ke project lain. Jika `payment_method_access_denied`, periksa policy/grant yang ditampilkan query di atas. Jika mendapat `server_not_configured`, konfigurasi DB server belum tersedia. Jangan pernah menaruh service-role key, password, token, atau credential dalam repository/log browser.


## Catatan custom public URL checkout (2026-11-04)

Perubahan custom gift URL di checkout tidak menambahkan atau mengubah schema. Keunikan telah disediakan oleh `public.gifts.slug UNIQUE` dan `public.slug_reservations.slug PRIMARY KEY` pada migration awal. Order transaction membuat row reservation dan memperbarui draft gift bersama-sama; tidak ada query SQL yang perlu Anda jalankan untuk checkpoint ini. Validasi produksi tetap memerlukan uji transaksi dan konkurensi di project non-production setelah konfigurasi tersedia.


## Catatan private Edit URL (2026-11-04)

Route `/edit/{token}` mencari nilai hash melalui kolom `gifts.edit_token_hash` yang sudah ada; adapter memetakan field domain `editTokenHash` ke kolom tersebut. Perubahan ini tidak mengubah database dan tidak membutuhkan SQL tambahan. Supabase live tidak terhubung saat pengujian; 3/3 tes adapter/schema dijalankan hanya terhadap PGlite lokal.


## Catatan order success/QR dan public gift controls (2026-11-04)

Perubahan UI untuk memindahkan QR/copy/share dari public gift ke detail order aman tidak memerlukan schema/migration baru. Slug hanya diberikan oleh service order-detail setelah verifikasi order access token dan konfirmasi status publication dari data gift/public gift yang sudah ada. Tidak ada SQL untuk dijalankan.


## Catatan customer media upload (2026-11-04)

Kode upload foto/audio menggunakan schema dan bucket yang sudah berada pada `supabase/migrations/20261104000100_customer_media_storage.sql`; tidak ada migration baru pada checkpoint ini. Migration tersebut membuat private bucket `gift-media`, `public.gift_media`, serta storage policy yang tidak memberi akses upload publik langsung. Gunakan urutan dan peringatan diagnosis di atas bila migration belum tercatat; jangan replay bundle secara otomatis pada project yang sedang mengalami incident schema.

Sebelum mengaktifkan fitur di deployment, pastikan migration/bucket benar-benar ada, konfigurasi DB runtime benar, dan `SUPABASE_SERVICE_ROLE_KEY` tersimpan hanya sebagai server secret. Baru kemudian set `NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED=true` dan deploy ulang. Fitur code defaults off jika env flag tidak disetel. Tidak ada SQL yang dijalankan terhadap project live; PGlite tests hanya memakai fixture lokal dan tidak membuktikan live policy/upload.


## Soft-delete transaksi (2026-11-04)

Perubahan database yang diperlukan adalah satu migration additive: `supabase/migrations/20261104000400_order_soft_delete.sql`. Ia menambahkan `orders.deleted_at` dan `orders.deleted_by_uid`; tidak menghapus/mengubah row, status pembayaran, foreign key, data gift, subscription, bukti, atau histori. Jalankan migration file tersebut melalui SQL Editor, atau jika memang ingin mengulang seluruh migration canonical, gunakan `supabase/manual_apply_all_migrations.sql` sebagai alternatif (bukan jalankan kedua prosedur berurutan secara otomatis). Bundle mencakup migration ini di dalam transaksi sebelum `COMMIT`.

Sesudah dijalankan, periksa `information_schema.columns` untuk dua kolom pada `public.orders`, lalu deploy kode yang menggunakan mapping tersebut. Verifikasi di staging: admin auth dapat soft-delete order awaiting-payment dan approved, actor tak berwenang ditolak, guest order token hanya dapat soft-delete order yang terkait, serta data gift/subscription/proof dan approved revenue tetap dipertahankan. PGlite test di repo tidak membuktikan keadaan migration/RLS/Storage pada Supabase live. Migration ini belum dijalankan ke project pengguna.


## Checkout contact fields (2026-11-04)

Checkout kini mewajibkan minimal salah satu dari email/WhatsApp. Keduanya sudah nullable pada `orders`, sehingga kanal yang tidak diisi disimpan `NULL` dan tidak perlu migration atau SQL manual. Validasi server tetap menolak order tanpa satu pun kontak dan memeriksa format setiap kanal yang diisi.


## Payment destination admin-only policy (2026-11-05)

Jalankan `supabase/migrations/20261105000100_payment_method_admin_only.sql` setelah migration payment-method authenticated management `20261104000300_payment_method_authenticated_management.sql`. Migration mengganti kebijakan luas yang semula mengizinkan semua user authenticated mengelola rekening/QR, tanpa mengubah data payment method. Hanya `admin_profiles.role in ('owner','admin')` yang dapat mengelola baris atau upload/delete image; kebijakan Storage juga membatasi metadata object ke folder UID peminta. User anonymous tetap hanya membaca metode aktif, dan bucket gambar tetap publik-read sesuai konfigurasi sebelumnya. Alternatif operator untuk schema canonical adalah bundle `supabase/manual_apply_all_migrations.sql` yang mencakup ketujuh migration. Jangan menjalankan SQL live secara otomatis; terapkan manual lalu verifikasi RLS dengan satu akun admin dan satu akun login biasa.
