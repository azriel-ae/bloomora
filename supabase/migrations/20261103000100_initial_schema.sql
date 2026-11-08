-- Bloomora initial Supabase schema.
-- Customers remain guests. Only provisioned owner/admin users exist in auth.users.
-- Server-side application code performs domain writes; direct client writes are denied.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id text primary key,
  name text not null,
  price_idr integer not null check (price_idr >= 0),
  duration_days integer not null check (duration_days > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  limits jsonb not null check (jsonb_typeof(limits) = 'object'),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0)
);

create table if not exists public.payment_methods (
  id text primary key,
  name text not null,
  instructions text not null default '',
  image_url text,
  image_path text,
  active boolean not null default false,
  sort_order integer not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0)
);

create table if not exists public.vouchers (
  id text primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  min_amount_idr integer not null default 0 check (min_amount_idr >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  deleted boolean not null default false,
  deleted_at timestamptz,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0),
  check (expires_at is null or starts_at is null or expires_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (not deleted or not active)
);
create index if not exists vouchers_active_code_idx on public.vouchers (code) where active;

-- Guest owner IDs are opaque synthetic identifiers, never auth.users foreign keys.
create table if not exists public.gifts (
  id text primary key,
  owner_uid text not null,
  edit_token_hash text,
  edit_token_expires_at timestamptz,
  customer_email text,
  customer_whatsapp text,
  template_id text,
  template_version integer not null default 1 check (template_version > 0),
  slug text not null unique,
  status text not null check (status in ('draft', 'published', 'archived', 'deleted')),
  draft_content jsonb not null check (jsonb_typeof(draft_content) = 'object'),
  draft_version integer not null default 0 check (draft_version >= 0),
  draft_updated_at timestamptz not null default now(),
  published_revision integer check (published_revision is null or published_revision > 0),
  published_at timestamptz,
  created_under_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  schema_version integer not null default 2 check (schema_version > 0)
);
create index if not exists gifts_owner_status_idx on public.gifts (owner_uid, status, updated_at desc);
create index if not exists gifts_owner_created_subscription_idx on public.gifts (owner_uid, created_under_subscription_id);
create index if not exists gifts_edit_token_hash_idx on public.gifts (edit_token_hash) where edit_token_hash is not null;

create table if not exists public.gift_revisions (
  gift_id text not null references public.gifts(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  template_id text not null,
  template_version integer not null check (template_version > 0),
  created_at timestamptz not null default now(),
  primary key (gift_id, revision_number)
);

-- Public rows deliberately contain only the published presentation, never guest PII,
-- owner IDs, order/payment records, subscription data, or edit-token hashes.
create table if not exists public.public_gifts (
  slug text primary key,
  status text not null check (status in ('published', 'archived', 'removed')),
  template_id text not null,
  template_version integer not null check (template_version > 0),
  revision integer not null check (revision > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_at timestamptz not null,
  updated_at timestamptz not null default now(),
  schema_version integer not null default 2 check (schema_version > 0)
);
create index if not exists public_gifts_published_idx on public.public_gifts (slug) where status = 'published';

-- Reservations survive gift deletion so public slugs are never reused.
create table if not exists public.slug_reservations (
  slug text primary key,
  gift_id text not null references public.gifts(id) on delete no action deferrable initially deferred,
  owner_uid text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_analytics (
  slug text primary key,
  total_views bigint not null default 0 check (total_views >= 0),
  first_viewed_at timestamptz not null,
  last_viewed_at timestamptz not null,
  views_by_day jsonb not null default '{}'::jsonb check (jsonb_typeof(views_by_day) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0)
);

create table if not exists public.orders (
  id text primary key,
  user_id text not null,
  gift_id text references public.gifts(id) on delete restrict,
  customer_email text,
  customer_whatsapp text,
  package_id text not null,
  payment_method_id text not null,
  payment_method_snapshot jsonb,
  order_access_token_hash text,
  order_access_token_previous_hashes text[] not null default '{}',
  voucher_code text,
  package_snapshot jsonb not null check (jsonb_typeof(package_snapshot) = 'object'),
  original_amount_idr integer check (original_amount_idr is null or original_amount_idr >= 0),
  discount_idr integer check (discount_idr is null or discount_idr >= 0),
  amount_idr integer not null check (amount_idr >= 0),
  status text not null check (status in ('awaiting_payment', 'proof_submitted', 'approved', 'rejected', 'cancelled')),
  proof_storage_path text,
  proof_content_type text,
  proof_size_bytes bigint check (proof_size_bytes is null or proof_size_bytes > 0),
  proof_submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,
  subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version integer not null default 2 check (schema_version > 0),
  check ((proof_storage_path is null and proof_content_type is null and proof_size_bytes is null and proof_submitted_at is null)
      or (proof_storage_path is not null and proof_content_type is not null and proof_size_bytes is not null and proof_submitted_at is not null)),
  check (status <> 'proof_submitted' or proof_storage_path is not null)
);
create index if not exists orders_owner_status_created_idx on public.orders (user_id, status, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_gift_idx on public.orders (gift_id) where gift_id is not null;
create unique index if not exists orders_access_token_hash_idx on public.orders (order_access_token_hash) where order_access_token_hash is not null;

create table if not exists public.subscriptions (
  id text primary key,
  user_id text not null,
  package_id text not null,
  order_id text not null unique references public.orders(id) on delete restrict,
  status text not null check (status in ('active', 'revoked')),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  package_snapshot jsonb not null check (jsonb_typeof(package_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version integer not null default 2 check (schema_version > 0),
  check (expires_at > started_at)
);
create index if not exists subscriptions_owner_active_expiry_idx on public.subscriptions (user_id, expires_at desc) where status = 'active';

create table if not exists public.subscription_schedules (
  user_id text primary key,
  last_subscription_id text not null references public.subscriptions(id) on delete restrict,
  last_started_at timestamptz not null,
  last_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  schema_version integer not null default 2 check (schema_version > 0),
  check (last_expires_at > last_started_at)
);

alter table public.orders
  add constraint orders_subscription_fk
  foreign key (subscription_id) references public.subscriptions(id) on delete restrict;
alter table public.gifts
  add constraint gifts_created_subscription_fk
  foreign key (created_under_subscription_id) references public.subscriptions(id) on delete restrict;

create table if not exists public.guest_order_idempotency (
  key_hash text primary key,
  owner_uid text not null,
  gift_id text not null references public.gifts(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  schema_version integer not null default 1 check (schema_version > 0),
  check (expires_at > created_at)
);
create index if not exists guest_order_idempotency_owner_expiry_idx on public.guest_order_idempotency (owner_uid, expires_at);

create table if not exists public.guest_edit_recoveries (
  token_hash text primary key,
  gift_id text not null references public.gifts(id) on delete restrict,
  owner_uid text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  destination_hash text not null,
  status text not null check (status in ('pending', 'sent', 'delivery_failed', 'redeemed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  failed_at timestamptz,
  used_at timestamptz,
  schema_version integer not null default 1 check (schema_version > 0),
  check (expires_at > created_at)
);
create index if not exists guest_edit_recoveries_owner_created_idx on public.guest_edit_recoveries (owner_uid, created_at desc);

create table if not exists public.rate_limits (
  bucket_hash text primary key,
  scope text not null,
  count integer not null check (count >= 0),
  window_started_at timestamptz not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0),
  check (reset_at > window_started_at)
);

create table if not exists public.admin_audit_logs (
  id text primary key,
  actor_uid text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  order_id text,
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_entity_created_idx on public.admin_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists admin_audit_logs_order_created_idx on public.admin_audit_logs (order_id, created_at) where order_id is not null;

-- Default package data is inserted only when absent. Re-running deploy/setup must not
-- overwrite admin-managed prices, limits, or active state.
insert into public.packages (id, name, price_idr, duration_days, active, sort_order, limits)
values
  ('basic', 'Basic', 19000, 3, true, 1, '{"maxGifts":1,"maxPhotos":8,"music":false,"priorityReview":false,"allowedTemplateTiers":["core"]}'::jsonb),
  ('plus', 'Plus', 39000, 14, true, 2, '{"maxGifts":1,"maxPhotos":20,"music":true,"priorityReview":false,"allowedTemplateTiers":["core","extended"]}'::jsonb),
  ('premium', 'Premium', 69000, 30, true, 3, '{"maxGifts":1,"maxPhotos":40,"music":true,"priorityReview":true,"allowedTemplateTiers":["core","extended"]}'::jsonb)
on conflict (id) do nothing;

-- Table-level RLS is enabled everywhere. Public SELECT is restricted to presentation-safe
-- rows. All state-changing operations go through authenticated server routes/services.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'admin_profiles', 'packages', 'payment_methods', 'vouchers', 'gifts',
    'gift_revisions', 'public_gifts', 'slug_reservations', 'gift_analytics',
    'orders', 'subscriptions', 'subscription_schedules', 'guest_order_idempotency',
    'guest_edit_recoveries', 'rate_limits', 'admin_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', relation_name);
  end loop;
end $$;

revoke all on table
  public.admin_profiles, public.packages, public.payment_methods, public.vouchers,
  public.gifts, public.gift_revisions, public.public_gifts, public.slug_reservations,
  public.gift_analytics, public.orders, public.subscriptions, public.subscription_schedules,
  public.guest_order_idempotency, public.guest_edit_recoveries, public.rate_limits,
  public.admin_audit_logs
from anon, authenticated;

grant select on public.packages, public.payment_methods, public.public_gifts to anon, authenticated;
grant select on public.admin_profiles to authenticated;

create policy packages_public_active_read on public.packages
  for select to anon, authenticated using (active = true);
create policy payment_methods_public_active_read on public.payment_methods
  for select to anon, authenticated using (active = true);
create policy public_gifts_published_read on public.public_gifts
  for select to anon, authenticated using (status = 'published');
create policy admin_profiles_read_self on public.admin_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- Guests have no Supabase Auth identity, so uploads are mediated by server routes using
-- server-only credentials after guest order-token checks. No anon/authenticated Storage
-- object policy is added; this bucket is private and direct client access is denied.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-method-images', 'payment-method-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.public_gifts is 'Only published presentation-safe gift content; must not contain owner or payment data.';
comment on table public.gifts is 'Private guest draft and ownership data. Access only through server-side authorization.';
comment on table public.guest_edit_recoveries is 'Server-only single-use recovery records; token and contact values are hashes only.';
comment on table public.orders is 'Guest/customer purchase and payment review state; reads/writes are server-authorized.';
