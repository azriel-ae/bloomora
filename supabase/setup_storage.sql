-- Bloomora Storage setup (Supabase SQL Editor)
-- Jalankan setelah public.gifts tersedia. Query ini idempotent.
--
-- Bucket:
--   payment-method-images : PUBLIC, gambar QRIS/rekening/metode pembayaran admin
--   payment-proofs        : PRIVATE, bukti transfer pelanggan
--   gift-media            : PRIVATE, foto dan lagu yang diunggah pelanggan
--
-- Aplikasi harus mengunggah/menghapus/membuat signed URL melalui server dengan
-- SUPABASE_SERVICE_ROLE_KEY. Jangan membuat policy anon/authenticated untuk
-- bucket private dan jangan mengirim service-role key ke browser.

create table if not exists public.gift_media (
  id text primary key,
  gift_id text not null references public.gifts(id) on delete restrict,
  owner_uid text not null,
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  schema_version integer not null default 1 check (schema_version > 0),
  check (
    (kind = 'image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    or
    (kind = 'audio' and content_type in ('audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a'))
  )
);
create index if not exists gift_media_owner_gift_idx on public.gift_media (owner_uid, gift_id, created_at desc);
create index if not exists gift_media_active_gift_idx on public.gift_media (gift_id, created_at desc) where deleted_at is null;
alter table public.gift_media enable row level security;
revoke all on table public.gift_media from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-method-images', 'payment-method-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-media', 'gift-media', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4',
              'audio/ogg', 'audio/wav', 'audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
