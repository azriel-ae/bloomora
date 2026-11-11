-- Immutable, append-only published snapshots for dynamic templates.
-- Upload drafts remain in dynamic_templates; this table is the future runtime source of truth.
create table if not exists public.dynamic_template_versions (
  template_id uuid not null references public.dynamic_templates(id) on delete restrict,
  template_key text not null,
  version integer not null check (version > 0),
  schema_version integer not null check (schema_version = 1),
  entitlement_tier text not null default 'core' check (entitlement_tier in ('core', 'extended')),
  renderer text not null check (renderer = 'custom-html'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  entry_point text not null check (entry_point !~ '(^/|(^|/)\.\.?(/|$))'),
  source_path text not null check (source_path !~ '(^/|(^|/)\.\.?(/|$))'),
  assets jsonb not null default '[]'::jsonb check (jsonb_typeof(assets) = 'array'),
  bundle_sha256 text not null check (bundle_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (template_id, version),
  unique (template_key, version),
  unique (source_path),
  check (manifest ->> 'id' = template_key),
  check ((manifest ->> 'version')::integer = version),
  check ((manifest ->> 'schemaVersion')::integer = schema_version),
  check (manifest ->> 'renderer' = renderer),
  check (manifest ->> 'entryPoint' = entry_point)
);

create index if not exists dynamic_template_versions_key_idx
  on public.dynamic_template_versions(template_key, version desc);

alter table public.dynamic_template_versions enable row level security;
revoke all on table public.dynamic_template_versions from public, anon, authenticated;
grant select, insert on table public.dynamic_template_versions to service_role;

-- Published source snapshots cannot be rewritten or removed through the application.
create or replace function public.reject_dynamic_template_version_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'published dynamic template versions are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists dynamic_template_versions_immutable on public.dynamic_template_versions;
create trigger dynamic_template_versions_immutable
  before update or delete on public.dynamic_template_versions
  for each row execute function public.reject_dynamic_template_version_mutation();
revoke all on function public.reject_dynamic_template_version_mutation() from public, anon, authenticated;
