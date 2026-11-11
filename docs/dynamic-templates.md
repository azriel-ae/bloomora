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

Manifest memuat `id`, `name`, `slug`, `version`, `description`, `author`, `category`, `tags`, `renderer`, `entryPoint`, `assets`, `supportedFeatures`, `supportedLocales`, `configurationSchema`, `requirements`, `compatibility`, dan `rendererMetadata`. Fitur, entry point, aset, requirements, renderer, dan kompatibilitas diturunkan atau dibatasi oleh analisis server; admin dapat mengedit metadata, bukan memperluas klaim kemampuan.

## Status dan publikasi

Status penyimpanan tetap menggunakan lifecycle database `draft` → `processing` → `validation_failed` atau `ready_for_preview` → `published`/`archived`; indikator langkah analisis ditampilkan selama request. `ready_for_preview` berarti lulus validasi upload untuk preview admin, bukan siap untuk customer.

**Publikasi saat ini fail-closed.** `lib/engine/registry.ts` hanya memuat `TemplateConfig` native yang punya kontrak section/field, renderer React, editor, entitlement, serta version pinning pada gift. Template HTML dari Storage belum diintegrasikan ke katalog, editor, draft, revision, entitlement, atau public gift. Endpoint publish menolak semua dynamic upload yang belum memiliki integrasi tersebut, sehingga status `published` tidak menjadi janji bahwa customer dapat menggunakannya. Untuk menyelesaikan target customer end-to-end perlu pipeline adapter dan version pinning yang kompatibel dengan `TemplateConfig` atau desain renderer customer HTML baru, kontrol editor yang disahkan, migrasi/loader registry, dan tes integrasi untuk gift lama.

## Database dan Storage

Migrasi `20261110000100_dynamic_templates.sql` dan `20261110000200_dynamic_template_lifecycle.sql` membuat tabel/indeks, RLS read-only untuk status published, bucket privat, dan status archive. Migrasi `20261111000100_dynamic_template_asset_mime.sql` menambahkan MIME media yang didukung analyzer ke bucket. Migrasi `20261111000200_dynamic_template_service_role_grants.sql` memberikan privilege `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` pada tabel serta `USAGE` pada schema `public` ke `service_role`; RLS tetap aktif dan service-role hanya digunakan server. Semua migration tersebut harus diterapkan di Supabase sebelum API admin digunakan. Aplikasi tidak menjalankan migration otomatis.

## Pengujian

Jalankan `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, dan `pnpm build`. Uji upload/storage live, preview di deployment, mobile/desktop secara visual, publikasi customer, entitlement, dan version pinning memerlukan Supabase/hosting yang terkonfigurasi; jangan menyatakan lulus bila lingkungan tersebut belum tersedia.
