-- Restrict payment destination configuration to provisioned Bloomora admins/owners.
-- Run after 20261104000300_payment_method_authenticated_management.sql.
-- Replaces broad authenticated-user policies; no payment-method data is changed.

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'payment_methods'
  loop
    execute format('drop policy %I on public.payment_methods', existing_policy.policyname);
  end loop;
end $$;

revoke all on table public.payment_methods from public, anon, authenticated;
grant select on table public.payment_methods to anon, authenticated;
grant insert, update, delete on table public.payment_methods to authenticated;

create policy payment_methods_public_active_read on public.payment_methods
  for select to anon, authenticated
  using (active = true);

create policy payment_methods_admin_management_read on public.payment_methods
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_profiles p
      where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')
    )
  );

create policy payment_methods_admin_insert on public.payment_methods
  for insert to authenticated
  with check (
    exists (
      select 1 from public.admin_profiles p
      where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')
    )
  );

create policy payment_methods_admin_update on public.payment_methods
  for update to authenticated
  using (
    exists (
      select 1 from public.admin_profiles p
      where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles p
      where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')
    )
  );

create policy payment_methods_admin_delete on public.payment_methods
  for delete to authenticated
  using (
    exists (
      select 1 from public.admin_profiles p
      where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin')
    )
  );

-- Public bucket reads are intentional for active checkout images. Mutations are
-- restricted to provisioned admins/owners; service-role API writes remain server-only.
drop policy if exists payment_method_images_authenticated_select on storage.objects;
drop policy if exists payment_method_images_authenticated_insert on storage.objects;
drop policy if exists payment_method_images_authenticated_update on storage.objects;
drop policy if exists payment_method_images_authenticated_delete on storage.objects;
drop policy if exists payment_method_images_admin_select on storage.objects;
drop policy if exists payment_method_images_admin_insert on storage.objects;
drop policy if exists payment_method_images_admin_update on storage.objects;
drop policy if exists payment_method_images_admin_delete on storage.objects;

create policy payment_method_images_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-method-images'
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
    and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin'))
  );

create policy payment_method_images_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-method-images'
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
    and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin'))
  );

create policy payment_method_images_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-method-images'
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
    and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin'))
  )
  with check (
    bucket_id = 'payment-method-images'
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
    and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin'))
  );

create policy payment_method_images_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-method-images'
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
    and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner', 'admin'))
  );
