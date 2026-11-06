-- Bloomora customer media storage extension.
-- Payment-method images are public; payment proofs and customer media are private.
-- All uploads/downloads are server-mediated with the service-role client.

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

-- Existing buckets are kept idempotent. Run this migration after the initial schema.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-method-images', 'payment-method-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-media', 'gift-media', false, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.gift_media is 'Private customer photo/audio metadata. Objects are uploaded and served only through authorized server routes.';
comment on column public.gift_media.storage_path is 'Private Storage path; never expose directly to clients or public gift documents.';
