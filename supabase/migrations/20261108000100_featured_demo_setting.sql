begin;

create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  schema_version integer not null default 1
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;

comment on table public.site_settings is 'Server-only Bloomora site configuration; writes require a verified admin service path.';

commit;
