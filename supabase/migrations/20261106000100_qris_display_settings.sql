-- Bloomora QRIS display configuration, separate from payment-method and order snapshots.
-- Run after the initial schema. This record is public-read and admin-write only through server services.
create table if not exists public.qris_display_settings (
  id text primary key check (id = 'default'),
  config jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0)
);

insert into public.qris_display_settings (id, config)
values ('default', '{"title":"Scan untuk membayar","description":"Gunakan aplikasi pembayaran pilihanmu.","backgroundColor":"#fffaf3","accentColor":"#66745d","borderColor":"#d9d1c5","footer":"Bloomora · pembayaran aman","logoUrl":null,"frameStyle":"card","decoration":"none"}'::jsonb)
on conflict (id) do nothing;

alter table public.qris_display_settings enable row level security;
revoke all on table public.qris_display_settings from public, anon, authenticated;
grant select on table public.qris_display_settings to anon, authenticated;
grant insert, update, delete on table public.qris_display_settings to authenticated;

drop policy if exists qris_display_public_read on public.qris_display_settings;
create policy qris_display_public_read on public.qris_display_settings
  for select to anon, authenticated using (id = 'default');

-- Route/service authorization remains authoritative; this policy only permits verified admins.
drop policy if exists qris_display_admin_write on public.qris_display_settings;
create policy qris_display_admin_write on public.qris_display_settings
  for all to authenticated using (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')))
  with check (exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')));
