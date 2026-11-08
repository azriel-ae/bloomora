-- Transfer Bloomora's existing admin role to a new Supabase Auth user.
--
-- BEFORE RUNNING:
-- 1. In Supabase Dashboard > Authentication > Users, invite/create
--    admin@bloomora.my.id and complete email verification.
-- 2. Confirm that admin@bloomora.app is still the current admin account.
-- 3. Run this script once in the Supabase SQL Editor.
--
-- This script does not create users, set passwords, or edit auth.users/auth.identities.
-- It moves the existing public.admin_profiles role to the verified new user's UUID,
-- so the old account no longer has Bloomora admin access.

begin;

do $$
declare
  old_email constant text := 'admin@bloomora.app';
  new_email constant text := 'admin@bloomora.my.id';
  old_user_id uuid;
  new_user_id uuid;
  old_role text;
  match_count integer;
  changed_count integer;
begin
  select count(*) into match_count
  from auth.users
  where lower(email) = lower(old_email);
  if match_count <> 1 then
    raise exception 'Expected exactly one Auth user for %, found %.', old_email, match_count;
  end if;
  select id into old_user_id
  from auth.users
  where lower(email) = lower(old_email);

  select count(*) into match_count
  from auth.users
  where lower(email) = lower(new_email);
  if match_count <> 1 then
    raise exception 'Create/invite and verify exactly one Supabase Auth user for % before running this script; found %.', new_email, match_count;
  end if;
  select id into new_user_id
  from auth.users
  where lower(email) = lower(new_email)
    and email_confirmed_at is not null;
  if new_user_id is null then
    raise exception 'The new Auth user''s email (%) is not confirmed yet.', new_email;
  end if;
  if new_user_id = old_user_id then
    raise exception 'Old and new emails resolve to the same Auth user; use Supabase Auth email-change flow instead of role transfer.';
  end if;

  select role into old_role
  from public.admin_profiles
  where user_id = old_user_id;
  if old_role is null or old_role not in ('owner', 'admin') then
    raise exception 'The old Auth user (%) does not have an owner/admin profile.', old_email;
  end if;
  if exists (select 1 from public.admin_profiles where user_id = new_user_id) then
    raise exception 'The new Auth user (%) already has an admin profile; stop and review both accounts before changing roles.', new_email;
  end if;

  update public.admin_profiles
  set user_id = new_user_id,
      updated_at = now()
  where user_id = old_user_id
    and role = old_role;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'Expected to transfer exactly one admin profile, changed %.', changed_count;
  end if;
end $$;

commit;

-- Verify the resulting admin login identity and role.
select u.id, u.email, p.role
from public.admin_profiles p
join auth.users u on u.id = p.user_id
where lower(u.email) = lower('admin@bloomora.my.id');
