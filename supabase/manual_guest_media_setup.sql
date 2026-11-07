-- Bloomora — setup tambahan guest media sebelum pembayaran
-- Jalankan di Supabase Dashboard -> SQL Editor.
-- Aman dijalankan ulang: tidak menghapus tabel, data, object, atau policy.
--
-- Keamanan:
-- 1. Bucket gift-media tetap PRIVATE.
-- 2. Tidak ada policy anon/authenticated untuk tabel metadata atau Storage.
-- 3. Upload, delete, dan signed URL hanya melalui server dengan
--    SUPABASE_SERVICE_ROLE_KEY. Jangan pernah mengirim key tersebut ke browser.
--
-- Jalankan setelah tabel public.gifts tersedia.

begin;

create table if not exists public.gift_media (
  id text primary key,
  gift_id text not null references public.gifts(id) on delete restrict,
  owner_uid text not null,
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  schema_version integer not null default 1 check (schema_version > 0),
  check (
    (kind = 'image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    or
    (kind = 'audio' and content_type in ('audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a'))
  )
);

create index if not exists gift_media_owner_gift_idx
  on public.gift_media (owner_uid, gift_id, created_at desc);

create index if not exists gift_media_active_gift_idx
  on public.gift_media (gift_id, created_at desc)
  where deleted_at is null;

alter table public.gift_media enable row level security;
revoke all on table public.gift_media from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-media',
  'gift-media',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.gift_media is
  'Private customer photo/audio metadata. Access is server-mediated only.';

comment on column public.gift_media.storage_path is
  'Private Storage path; never expose directly to clients or public gift documents.';

commit;

-- Verifikasi 1: harus menghasilkan satu baris dengan public = false.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'gift-media';

-- Verifikasi 2: RLS harus aktif dan role client tidak memiliki privilege.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', 'public.gift_media', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'public.gift_media', 'select') as authenticated_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'gift_media';

-- Verifikasi 3: kolom metadata harus tersedia.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'gift_media'
order by ordinal_position;
