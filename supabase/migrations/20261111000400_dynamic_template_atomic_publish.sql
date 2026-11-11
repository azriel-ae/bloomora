-- Atomic admin publish for one validated dynamic-template bundle snapshot.
-- The function invocation runs inside one PostgreSQL transaction; failures roll back both writes.
create or replace function public.publish_dynamic_template_version(
  p_template_id uuid,
  p_template_key text,
  p_version integer,
  p_schema_version integer,
  p_expected_manifest jsonb,
  p_manifest jsonb,
  p_entry_point text,
  p_source_path text,
  p_assets jsonb,
  p_bundle_sha256 text,
  p_actor uuid
)
returns table (template_key text, version integer, status text, published_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_parent public.dynamic_templates%rowtype;
  v_existing public.dynamic_template_versions%rowtype;
  v_published_at timestamptz;
begin
  if p_template_id is null or p_actor is null or p_template_key is null
    or p_version is null or p_schema_version is null or p_schema_version <> 1 or p_version < 1
    or p_expected_manifest is null or p_entry_point is null or p_source_path is null
    or p_bundle_sha256 is null
    or p_manifest is null or jsonb_typeof(p_manifest) <> 'object'
    or p_assets is null or jsonb_typeof(p_assets) <> 'array'
    or p_bundle_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid dynamic template snapshot input' using errcode = '22023';
  end if;

  select * into v_parent
    from public.dynamic_templates
    where id = p_template_id
    for update;
  if not found then
    raise exception 'dynamic template not found' using errcode = 'P0002';
  end if;

  if v_parent.status not in ('ready_for_preview', 'published') then
    raise exception 'dynamic template is not ready to publish' using errcode = '55000';
  end if;
  if v_parent.renderer <> 'custom-html'
    or v_parent.slug is distinct from substring(p_template_key from 9)
    or v_parent.version is distinct from p_version
    or v_parent.source_path is distinct from p_source_path
    or v_parent.manifest is distinct from p_expected_manifest then
    raise exception 'dynamic template changed during publish' using errcode = '40001';
  end if;
  if jsonb_typeof(coalesce(v_parent.validation_errors, '[]'::jsonb)) <> 'array' then
    raise exception 'dynamic template validation state is corrupt' using errcode = '55000';
  end if;
  if jsonb_array_length(coalesce(v_parent.validation_errors, '[]'::jsonb)) <> 0 then
    raise exception 'dynamic template validation failed' using errcode = '55000';
  end if;
  if p_template_key <> ('dynamic-' || v_parent.slug)
    or p_manifest ->> 'id' is distinct from p_template_key
    or (p_manifest ->> 'version')::integer is distinct from p_version
    or (p_manifest ->> 'schemaVersion')::integer is distinct from p_schema_version
    or p_manifest ->> 'renderer' <> 'custom-html'
    or p_manifest ->> 'entryPoint' is distinct from p_entry_point
    or p_assets is distinct from p_manifest -> 'assets'
    or p_entry_point !~ '(^/|(^|/)\.\.?(/|$))'
    or p_source_path !~ '(^/|(^|/)\.\.?(/|$))' then
    raise exception 'dynamic template snapshot does not match source metadata' using errcode = '22023';
  end if;

  select * into v_existing
    from public.dynamic_template_versions
    where template_id = p_template_id and dynamic_template_versions.version = p_version;

  if found then
    if v_existing.template_key is distinct from p_template_key
      or v_existing.schema_version is distinct from p_schema_version
      or v_existing.entitlement_tier <> 'core'
      or v_existing.renderer <> 'custom-html'
      or v_existing.manifest is distinct from p_manifest
      or v_existing.entry_point is distinct from p_entry_point
      or v_existing.source_path is distinct from p_source_path
      or v_existing.assets is distinct from p_assets
      or v_existing.bundle_sha256 is distinct from p_bundle_sha256 then
      raise exception 'immutable template version already exists with different content' using errcode = '55000';
    end if;
    v_published_at := v_existing.published_at;
  else
    if v_parent.status = 'published' then
      raise exception 'published template has no matching immutable version' using errcode = '55000';
    end if;
    v_published_at := now();
    insert into public.dynamic_template_versions (
      template_id, template_key, version, schema_version, entitlement_tier, renderer,
      manifest, entry_point, source_path, assets, bundle_sha256, published_at, created_by
    ) values (
      p_template_id, p_template_key, p_version, p_schema_version, 'core', 'custom-html',
      p_manifest, p_entry_point, p_source_path, p_assets, p_bundle_sha256, v_published_at, p_actor
    );
  end if;

  if v_parent.status <> 'published' then
    update public.dynamic_templates
      set status = 'published', published_at = v_published_at
      where id = p_template_id;
  end if;

  return query select p_template_key, p_version, 'published'::text, v_published_at;
end;
$$;

revoke all on function public.publish_dynamic_template_version(uuid, text, integer, integer, jsonb, jsonb, text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_dynamic_template_version(uuid, text, integer, integer, jsonb, jsonb, text, text, jsonb, text, uuid) to service_role;
