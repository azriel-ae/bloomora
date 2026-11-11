# Dynamic Template Management

Admin membuka `/admin/templates` dan mengunggah tepat satu file HTML atau satu ZIP. Sistem memilih entry point HTML, menganalisis struktur dan resource, membuat draf manifest, lalu memberi admin kesempatan meninjau atau mengedit metadata sebelum source disimpan ke bucket privat `dynamic-templates`. Admin tidak memilih renderer.

## Alur analisis

1. Upload satu HTML atau ZIP (maks. 50 MiB); ZIP dibatasi 100 MiB hasil ekstraksi dan 500 file.
2. Jalur ZIP dinormalisasi dan menolak traversal, file/ekstensi berbahaya, jalur duplikat, dan MIME yang tidak sesuai.
3. HTML, CSS, JavaScript, aset gambar/font/audio/video, language hint, entry point, resource eksternal/lokal, kontrol interaktif, dan field editor yang secara eksplisit diberi `data-bloomora-field` dianalisis tanpa menjalankan source code.
4. `manifest.json` dibuat otomatis dan dapat ditinjau. Klaim renderer, fitur, dan konfigurasi diuji ulang terhadap hasil analisis; metadata `compatibility` selalu ditetapkan server.
5. ZIP yang hanya berisi source React/TSX tidak dieksekusi atau dibuild. Sampai build worker terisolasi tersedia, format tersebut gagal dengan alasan dan saran unggah hasil build statis.
6. Source disimpan hanya setelah analisis lolos pemeriksaan wajib. Kegagalan upload/insert membersihkan objek yang sudah diunggah; prefix Storage memakai ID acak.

Deteksi resource merupakan analisis statis, bukan bukti bahwa URL eksternal hidup/aman. Resource eksternal dilaporkan sebagai belum diverifikasi dan diblokir oleh Content Security Policy preview. Referensi lokal yang hilang dilaporkan dengan jalur file. Deteksi viewport atau `@media` bukan hasil uji responsif.

## Preview dan batas keamanan

- Source disimpan di private Storage, tidak pernah dieksekusi pada server produksi, dan tidak menerima akses Supabase/service-role, database, cookies DOM, atau API internal dari bridge.
- Preview memakai iframe `sandbox="allow-scripts"` tanpa `allow-same-origin`, tanpa form/pop-up, dengan CSP ketat (koneksi eksternal, form submit, object, dan navigasi basis dibatasi).
- Asset preview hanya diambil melalui route aplikasi yang memeriksa token HMAC berumur lima menit dan membaca path yang telah divalidasi dari bucket private.
- Source SVG/HTML tetap dianggap tidak tepercaya. Jangan mengendurkan sandbox atau memperkenalkan `allow-same-origin` tanpa desain origin terisolasi dan pengujian keamanan.
- Field editor hanya dihasilkan dari penanda eksplisit `data-bloomora-field`; sistem tidak menyimpulkan kemampuan foto, musik, warna, atau konten interaktif dari tampilan visual.

## Manifest minimum

Manifest memiliki `schemaVersion: 1` dan memuat `id`, `name`, `slug`, `version`, `description`, `author`, `category`, `tags`, `renderer`, `entryPoint`, `assets`, `supportedFeatures`, `supportedLocales`, `configurationSchema`, `requirements`, `compatibility`, dan `rendererMetadata`. Manifest lama tanpa `schemaVersion` dibaca sebagai v1 pada parser kompatibilitas; schema lain ditolak. Renderer yang disokong tahap fondasi adalah `custom-html`; `custom-react` tetap gagal karena build worker belum tersedia.

### Kontrak editor dan konten v1

`configurationSchema.fields` hanya menerima field yang terdeteksi server pada HTML melalui `data-bloomora-field`. Field v1 berbentuk `{ key, label, type, maxLength, defaultValue, required }`; `type` hanya `text` atau `textarea`, key harus unik, dan nilai customer selalu string biasa. Batas default adalah 200 karakter untuk `text` dan 2.000 untuk `textarea`, dengan `maxLength` tidak dapat melampaui 2.000. `defaultValue` dibatasi oleh `maxLength`. `validateDynamicTemplateValues` mengisi default, menolak properti yang tidak dideklarasikan, nilai bukan string, field schema rusak, dan nilai terlalu panjang. `missingRequiredDynamicTemplateFields` memisahkan pemeriksaan kelengkapan publish agar Draft boleh belum lengkap. Konten disimpan sebagai plain data yang kompatibel dengan `GiftContent.fields`, bukan HTML/script.

Gambar, galeri, audio/video, warna, toggle, list/repeater, upload media, serta konfigurasi renderer belum menjadi kontrol editor customer yang didukung. Keberadaan aset visual di source tidak mengubahnya menjadi field editabel. Admin tidak dapat menambah key field yang tidak terdeteksi HTML, mengubah renderer, atau menyatakan fitur yang tidak ditemukan analyzer. Manifest merupakan metadata konfigurasi, bukan trust boundary: server memvalidasi ulang data customer terhadap snapshot manifest yang tersimpan.

### Entitlement

Snapshot dynamic versi menyimpan `entitlement_tier` terpisah dari manifest dan tidak menerima pilihan tier dari browser/upload. Semua versi pada fondasi ini dipetakan ke `core` karena upload dynamic belum mempunyai aturan tier/peninjauan premium tersendiri. Keputusan ini menggunakan daftar tier paket yang sama dengan template native, bukan sistem subscription baru. Setelah adapter ini dipasang ke route customer, create/edit/save/publish/republish wajib melalui Model B dan memerlukan subscription aktif serta tier yang diizinkan paket; expiry tidak menghapus draft atau gift dan tidak membatasi akses public gift yang telah dipublikasikan. Republish tetap membutuhkan entitlement aktif. Stack renewal tetap mengikuti logika subscription Bloomora yang ada.

### Immutable version snapshot dan revision

Migration `20261111000300_dynamic_template_versions.sql` menambahkan `dynamic_template_versions`, append-only dengan primary key `(template_id, version)`, template key stabil (`dynamic-<slug>`), schema version, manifest snapshot, renderer, entry point, asset list, private Storage source prefix, checksum SHA-256, tier entitlement, waktu publish, dan pembuat. RLS aktif tanpa akses `anon`/`authenticated`; hanya `service_role` mendapat `SELECT`/`INSERT`. Trigger database menolak update/delete, FK menolak menghapus template identity yang masih punya versi, dan source path unik menghindari perubahan referensi lintas versi. `createDynamicTemplateVersionSnapshot` menghitung SHA-256 dari manifest tervalidasi dan file berurutan deterministik, serta memastikan seluruh aset bundle terdaftar.

`appendDynamicTemplateVersion` adalah operasi append admin-only dan `loadDynamicTemplateVersionForServer` hanya membaca pasangan `template_key`/`version` yang diminta—tidak pernah memilih versi terbaru. `dynamicVersionToTemplateInfo` mengadaptasi manifest terpin ke validator service Bloomora; ia menerima hanya field plain-text dan menolak section/data/media belum didukung. Semua ini kode server internal; belum ada route yang memanggilnya atau katalog Published customer. **Belum ada transaksi publish yang mengoordinasikan insert snapshot, perubahan lifecycle row admin, dan revisi gift;** jangan memanggil insert primitive sebagai pengganti alur publish atomik. Migration belum diterapkan otomatis ke Supabase.

Migration tidak mengubah tabel native gifts karena `gifts`, `gift_revisions`, dan `public_gifts` sudah menyimpan pasangan `template_id`/`template_version`. Dengan adapter exact-version, pasangan stabil `dynamic-<slug>` + versi immutable dapat mengalir pada kolom yang ada tanpa sistem revision paralel. Native routes saat ini tetap memakai registry native; dynamic customer create/save/publish/public route belum memanggil adapter dan tetap diblokir.

### Kontrak runtime publik (belum diimplementasikan)

Public route harus mengambil `template_id`/`template_version` yang tersimpan pada public gift/revision, lalu meminta snapshot versi tersebut secara tepat—tidak pernah fall-forward ke versi terbaru. Response publik hanya boleh memuat manifest/runtime-safe metadata dan `GiftContent` tervalidasi, tanpa owner, email, token guest, order, subscription, atau data admin. Bundle harus tetap berada di private Storage dan hanya diambil server-side atau lewat delivery route terbatas untuk versi immutable.

HTML/JavaScript upload wajib dijalankan pada origin/site terisolasi dari aplikasi, dalam iframe dengan sandbox tanpa `allow-same-origin`, tanpa akses cookie/database/internal API, dengan CSP ketat dan jaringan dibatasi. Data dikirim melalui protokol `postMessage` ber-schema yang memeriksa source, nonce, dan origin sesuai desain isolated-origin; tidak boleh `eval`/`new Function`. Bloomora belum mempunyai origin/runtime terisolasi atau loader public bundle, sehingga kontrak ini belum menjadi kode eksekusi dan tidak membuat customer runtime siap.

## Status dan publikasi

Status penyimpanan tetap menggunakan lifecycle database `draft` → `processing` → `validation_failed` atau `ready_for_preview` → `published`/`archived`; indikator langkah analisis ditampilkan selama request. `ready_for_preview` berarti lulus validasi upload untuk preview admin, bukan siap untuk customer. Status parent `published` saja bukan sumber versi immutable; versi runtime hanya boleh berasal dari baris child snapshot yang tidak dapat diubah.

**Publikasi saat ini fail-closed.** `lib/engine/registry.ts` hanya memuat `TemplateConfig` native yang punya kontrak section/field, renderer React, editor, entitlement, serta version pinning pada gift. Template HTML dari Storage belum diintegrasikan ke katalog, editor, draft, revision, entitlement, atau public gift. Endpoint publish menolak semua dynamic upload yang belum memiliki integrasi tersebut, sehingga status `published` tidak menjadi janji bahwa customer dapat menggunakannya. Untuk menyelesaikan target customer end-to-end perlu pipeline adapter dan version pinning yang kompatibel dengan `TemplateConfig` atau desain renderer customer HTML baru, kontrol editor yang disahkan, migrasi/loader registry, dan tes integrasi untuk gift lama.

## Database dan Storage

Migrasi `20261110000100_dynamic_templates.sql` dan `20261110000200_dynamic_template_lifecycle.sql` membuat tabel/indeks, RLS read-only untuk status published, bucket privat, dan status archive. Migrasi `20261111000100_dynamic_template_asset_mime.sql` menambahkan MIME media yang didukung analyzer ke bucket. Migrasi `20261111000200_dynamic_template_service_role_grants.sql` memberikan privilege server pada tabel draft; migration `20261111000300_dynamic_template_versions.sql` menambahkan snapshot immutable append-only dengan akses server saja. Semua migration harus diterapkan berurutan di Supabase sebelum API terkait digunakan. Aplikasi tidak menjalankan migration otomatis. Migration versi baru belum diverifikasi pada database live.

## Pengujian

Jalankan `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, dan `pnpm build`. Uji upload/storage live, preview di deployment, mobile/desktop secara visual, publikasi customer, entitlement, dan version pinning memerlukan Supabase/hosting yang terkonfigurasi; jangan menyatakan lulus bila lingkungan tersebut belum tersedia.
