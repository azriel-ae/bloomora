begin;

create table if not exists public.guest_edit_links (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  gift_id text not null references public.gifts(id) on delete restrict,
  owner_uid text not null,
  order_id text not null references public.orders(id) on delete restrict,
  issued_by_admin_uid text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  schema_version integer not null default 1 check (schema_version > 0),
  check (expires_at > created_at)
);

create index if not exists guest_edit_links_gift_expiry_idx
  on public.guest_edit_links (gift_id, expires_at)
  where revoked_at is null;

alter table public.guest_edit_links enable row level security;
revoke all on table public.guest_edit_links from anon, authenticated;
grant all on table public.guest_edit_links to service_role;

comment on table public.guest_edit_links is
  'Server-only hashed customer editor bearer links issued by admins; raw tokens are returned once and expire within 30 days.';

commit;
