# Arsitektur Bloomora

## Stack (dari `package.json`)

Next.js 15 (App Router), React 19, TypeScript 5.8, Tailwind CSS 3.4, Firebase 11 (client) dan firebase-admin 13 (server), zod, react-hook-form, framer-motion, lucide-react, qrcode.react, @google/genai (chatbot). Paket manager pnpm 10. Deploy target: Vercel. Firebase BELUM terhubung dan Storage BELUM disediakan (Blaze belum disetujui).

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
lib/server/              service transaksional, interface Store, adapter Firestore, helper HTTP
lib/packages.ts          seed paket     lib/slug.ts   lib/features.ts
firebase/                rules dan indeks (belum dideploy)
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
              produksi: firestore-store.ts (Admin SDK)      uji: Fake Store + sandbox memori development eksplisit
```

- Semua tulis ke Firestore melalui server. Rules menolak semua tulis dari client.
- Service membaca subscription pengguna, memanggil fungsi murni di `lib/entitlements.ts`, lalu menulis. Identitas selalu dari sesi, bukan dari body request.
- `ServiceError` menjadi respons `{ ok:false, code }`. Kode editor dipetakan ke teks dua bahasa; konflik 409 tidak di-retry secara buta.
- Fake Store meniru aturan Firestore (semua baca sebelum tulis, `create` gagal bila ada, rollback atomik).

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

## Rencana integrasi Firebase (belum dikerjakan)

1. Setelah aplikasi selesai: buat konfigurasi env (lihat README), deploy `firestore.rules` dan `firestore.indexes.json`, seed koleksi `packages`.
2. Jalankan `pnpm test:rules` di emulator; tambahkan tes Storage rules.
3. Verifikasi `firestore-store.ts` terhadap emulator (adapter belum pernah dijalankan dengan SDK asli).
4. Ganti bagian UI yang masih statis dengan data nyata lewat route server.
5. Setelah persetujuan Blaze: provisikan Storage, bangun unggahan yang dikeluarkan server dengan batas tipe, ukuran, jumlah; salin media ke `public/gifts/{slug}/{revisi}/` saat publish; baru ubah `MEDIA_UPLOAD_ENABLED`.
6. Uji keamanan, lalu deployment.

## Batas mock dan produksi

| Bagian | Kondisi |
|---|---|
| Logika entitlement, service, validasi, engine, renderer | Nyata dan diuji (Fake Store, browser) |
| Adapter Firestore Admin, route handler, `runtime.ts` | Ditulis, BELUM pernah dijalankan dengan Firebase atau dikompilasi Next |
| Rules Firestore/Storage | Ditulis, BELUM divalidasi atau diuji di emulator |
| Auth sesi (`lib/session.ts`) | Kode lama, bergantung Firebase, belum diuji di sini |
| Pembayaran | Hanya order dan persetujuan admin di service. Tidak ada bukti bayar, tidak ada UI admin, tidak ada pembayaran sungguhan |
| Editor, dashboard, halaman publik `/g/[slug]`, admin | Editor/draft Phase 5 menggunakan service dan sandbox dev khusus untuk tes; dashboard/admin masih statis; `/g/[slug]` masih placeholder dan belum memakai service publik |
| Upload media | Dinonaktifkan |
