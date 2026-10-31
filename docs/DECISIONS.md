# Keputusan bisnis dan teknis

Setiap butir diberi status: DISEPAKATI (pengguna menyatakannya), DIIMPLEMENTASIKAN (ada di kode), TERTUNDA, atau DIVERGENSI (keputusan dan kode berbeda). Dokumen ini tidak mengubah kode; divergensi harus diselesaikan dengan persetujuan pengguna.

## Divergensi yang harus diselesaikan lebih dulu

1. **Stacking perpanjangan.** Pengguna menyatakan kebijakan perpanjangan menumpuk sisa masa aktif. KODE BELUM MELAKUKANNYA: `approveOrder` memulai subscription pada waktu persetujuan (`planSubscriptionActivation`), tidak menumpuk, dan `resolveEntitlement` memakai subscription aktif yang paling lama. Tes saat ini (`entitlements.test.ts`, `services.test.ts`) menegaskan perilaku tanpa stacking. Untuk mengimplementasikan: di dalam transaksi `approveOrder`, baca subscription aktif milik pengguna, lalu `startedAt = max(sekarang, expiresAt aktif terjauh)`, dan perbarui tes. Belum dikerjakan karena itu perubahan business logic yang butuh persetujuan eksplisit.
2. **Batas gift per subscription.** Belum ada keputusan. KODE SEMENTARA menerapkan `maxGifts: 1` per subscription (disalin dari teks halaman harga "1 gift"), dihitung lewat `createdUnderSubscriptionId` termasuk gift yang sudah dihapus. Ini asumsi sementara, bukan keputusan. Bila diputuskan tidak ada batas, ubah nilai di `lib/packages.ts` dan tes terkait.

## Keputusan

| # | Keputusan | Status |
|---|---|---|
| 1 | **Model B**: paket mengatur hak membuat, mengedit, dan memublikasikan. Paket TIDAK mengatur umur gift yang sudah terbit. Gift terbit tetap bisa dibuka publik tanpa batas waktu setelah paket pemilik habis | DISEPAKATI. DIIMPLEMENTASIKAN (`lib/entitlements.ts`, `lib/server/services.ts`, rules, tes). Fungsi visibilitas publik hanya menerima status dokumen publik, bukan subscription |
| 2 | Pembayaran manual QRIS dengan verifikasi admin. Subscription hanya lahir dari persetujuan admin atas order yang bukti bayarnya sudah diajukan | DISEPAKATI. SEBAGIAN: order, `approveOrder`, `rejectOrder`, audit log, route admin ada dan diuji dengan Fake Store. Pengajuan bukti, halaman QRIS interaktif, dan UI admin belum ada |
| 3 | Setelah subscription habis: tidak bisa membuat, mengedit, memublikasikan, atau memulihkan arsip. Tetap bisa melihat, menyalin link, mengarsipkan, dan menghapus gift sendiri | DISEPAKATI. DIIMPLEMENTASIKAN |
| 4 | Perpanjangan menumpuk sisa masa aktif | DISEPAKATI. DIVERGENSI (lihat atas) |
| 5 | Template: satu Featured Demo saja (`chapter-of-us`), bukan 10 demo. Template lain tampil sebagai katalog biasa tanpa demo palsu. Tier `core` dan `extended` menentukan paket mana yang boleh memakai. Featured Demo bertier `core` agar semua paket bisa memakainya | DISEPAKATI. DIIMPLEMENTASIKAN |
| 6 | Versi template tidak pernah diedit. Perubahan field atau layout = entri baru `version + 1`. Gift menyimpan versi yang dipakainya. Template nonaktif hilang dari katalog tetapi gift lama tetap render dan bisa diedit | DIIMPLEMENTASIKAN |
| 7 | Data privat `gifts` dipisah dari `publicGifts/{slug}` yang hanya ditulis server dan tidak memuat uid pemilik, order, atau subscription | DISEPAKATI. DIIMPLEMENTASIKAN (tipe, service, rules) |
| 8 | Draft tidak boleh menimpa versi terbit sebelum republish. Menyimpan draft hanya menyentuh `gifts`. Publish memakai `expectedVersion` (yang dipratinjau), membuat revisi immutable, lalu menulis `publicGifts` | DISEPAKATI. DIIMPLEMENTASIKAN |
| 9 | Arsip menyembunyikan gift publik (status `archived`) dan bisa dipulihkan pemilik selama paket aktif. Hapus bersifat soft: `publicGifts` menjadi `removed` dengan konten dikosongkan, slug tetap dicadangkan selamanya, draft dan revisi privat dipertahankan (penghapusan permanen adalah langkah eksplisit di masa depan). Pencabutan oleh admin (`removed`) tidak bisa dibatalkan pemilik lewat publish ulang | DISEPAKATI. DIIMPLEMENTASIKAN. Alat moderasi admin belum ada |
| 10 | Slug 12 karakter acak (CSPRNG, alfabet 31 simbol), tidak memuat uid, dialokasikan saat gift dibuat dan tidak berubah | DIIMPLEMENTASIKAN |
| 11 | Firebase belum terhubung. Pengembangan memakai interface `Store` dan Fake Store untuk uji logika. Tidak ada localStorage atau file lokal sebagai pengganti database | DISEPAKATI. DIIMPLEMENTASIKAN |
| 12 | Tidak boleh mengaktifkan Firebase Blaze atau billing tanpa persetujuan eksplisit | DISEPAKATI |
| 13 | Upload bukti bayar ditunda sampai Firebase Storage siap | DISEPAKATI. TERTUNDA. Opsi menyimpan bukti kecil di Firestore pernah diusulkan dan tidak dipilih |
| 14 | Upload gambar dan audio nonaktif lewat konstanta kompilasi `MEDIA_UPLOAD_ENABLED = false`. Klien tidak pernah menulis ke Storage; unggahan nanti dikeluarkan server setelah cek entitlement | DISEPAKATI. DIIMPLEMENTASIKAN (flag, rules) |
| 15 | Tanpa emoji atau glyph mirip emoji di desain. Ilustrasi adalah SVG original, bukan foto, sampai ada foto berlisensi | DISEPAKATI. Ditegakkan oleh gerbang `validate-config.ts` dan tes browser |
| 16 | Hormati `prefers-reduced-motion`. Template dapat memilih `motion: 'none'` | DISEPAKATI. DIIMPLEMENTASIKAN dan diuji |
| 17 | Font memakai system stack (tanpa dependency atau request jaringan) | DIIMPLEMENTASIKAN. Dapat diubah ke `next/font` |
| 18 | Harga dan durasi paket: Basic Rp19.000/3 hari, Plus Rp39.000/14 hari, Premium Rp69.000/30 hari. Konstanta di `lib/packages.ts` mencerminkan halaman harga dan menjadi seed. Koleksi Firestore `packages` akan menjadi sumber otoritatif | DIIMPLEMENTASIKAN sebagai seed |
| 19 | Tidak ada dependency baru ditambahkan. Dev tooling harness (esbuild, playwright, @firebase/rules-unit-testing, firebase-tools) belum ada di `package.json` agar lockfile pnpm tetap sinkron untuk Vercel | DIIMPLEMENTASIKAN |

## Catatan terkait temuan lama

- Header lama (`components/language-switcher.tsx`) memakai emoji bendera. Itu di luar area desain baru dan belum diubah.
- Chip kategori di `/templates` adalah `<span>` tanpa fungsi (kondisi asli). Akan diganti saat Phase 4.
- Teks FAQ, `/expiration`, dan `plan.md` lama masih menyiratkan gift kedaluwarsa. Bertentangan dengan Model B dan harus ditulis ulang di fase UI.
