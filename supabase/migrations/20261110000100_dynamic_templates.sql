-- Dynamic template management. Source files never execute on the application server.
create table if not exists public.dynamic_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null,
  renderer text not null check (renderer in ('native', 'custom-html', 'custom-react')),
  status text not null default 'draft' check (status in ('draft','processing','validation_failed','ready_for_preview','published')),
  version integer not null default 1 check (version > 0),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  entry_point text,
  source_path text,
  thumbnail_path text,
  build_path text,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  created_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dynamic_templates_catalog_idx on public.dynamic_templates(status, updated_at desc);

alter table public.dynamic_templates enable row level security;
revoke all on table public.dynamic_templates from anon, authenticated;
grant select on public.dynamic_templates to anon, authenticated;
create policy dynamic_templates_public_published_read on public.dynamic_templates
  for select to anon, authenticated using (status = 'published');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dynamic-templates', 'dynamic-templates', false, 52428800,
  array['application/zip','text/html','text/css','text/javascript','application/javascript','application/typescript','image/jpeg','image/png','image/webp','image/svg+xml','font/woff','font/woff2','application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.dynamic_templates_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists dynamic_templates_updated_at on public.dynamic_templates;
create trigger dynamic_templates_updated_at before update on public.dynamic_templates for each row execute function public.dynamic_templates_updated_at();
