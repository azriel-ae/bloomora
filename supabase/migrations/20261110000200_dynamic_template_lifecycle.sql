-- Safe archive/delete lifecycle for dynamic templates.
alter table public.dynamic_templates
  drop constraint if exists dynamic_templates_status_check;
alter table public.dynamic_templates
  add constraint dynamic_templates_status_check
  check (status in ('draft','processing','validation_failed','ready_for_preview','published','archived'));

-- Keep the public-read policy fail-closed for archived templates.
drop policy if exists dynamic_templates_public_published_read on public.dynamic_templates;
create policy dynamic_templates_public_published_read
  on public.dynamic_templates
  for select to anon, authenticated
  using (status = 'published');
