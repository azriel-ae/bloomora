-- Allow any verified Supabase Auth user to manage payment methods.
-- Run after 20261103000100_initial_schema.sql and 20261104000200_payment_method_details.sql.
-- Does not open write access to anon/public and preserves existing payment-method data.

-- Replace all prior table policies so stale role-specific policies cannot conflict.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'payment_methods'
  loop
    execute format('drop policy %I on public.payment_methods', existing_policy.policyname);
  end loop;
end $$;

revoke all on table public.payment_methods from public, anon, authenticated;
grant select on table public.payment_methods to anon, authenticated;
grant insert, update, delete on table public.payment_methods to authenticated;

-- Customers/public visitors may read active methods only. Authenticated users may
-- read all methods in the dashboard, including inactive entries.
create policy payment_methods_public_active_read on public.payment_methods
  for select to anon, authenticated
  using (active = true);

create policy payment_methods_authenticated_management_read on public.payment_methods
  for select to authenticated
  using ((select auth.uid()) is not null);

create policy payment_methods_authenticated_insert on public.payment_methods
  for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy payment_methods_authenticated_update on public.payment_methods
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy payment_methods_authenticated_delete on public.payment_methods
  for delete to authenticated
  using ((select auth.uid()) is not null);

-- Payment-method images are publicly readable by bucket design, but writes must
-- only be possible for an authenticated user and only below that user's own UID path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-method-images', 'payment-method-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke insert, update, delete on table storage.objects from public, anon;
grant select, insert, update, delete on table storage.objects to authenticated;

drop policy if exists payment_method_images_authenticated_select on storage.objects;
drop policy if exists payment_method_images_authenticated_insert on storage.objects;
drop policy if exists payment_method_images_authenticated_update on storage.objects;
drop policy if exists payment_method_images_authenticated_delete on storage.objects;

create policy payment_method_images_authenticated_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-method-images'
    and (select auth.uid()) is not null
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
  );

create policy payment_method_images_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-method-images'
    and (select auth.uid()) is not null
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
  );

create policy payment_method_images_authenticated_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-method-images'
    and (select auth.uid()) is not null
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
  )
  with check (
    bucket_id = 'payment-method-images'
    and (select auth.uid()) is not null
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
  );

create policy payment_method_images_authenticated_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-method-images'
    and (select auth.uid()) is not null
    and name like ('payment-methods/' || (select auth.uid())::text || '/%')
  );
