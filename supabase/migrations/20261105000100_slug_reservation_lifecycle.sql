-- Slug lifecycle fix: draft reservations are reclaimable, checkout holds are time-bounded.
-- Existing rows remain valid; NULL means a legacy reservation whose owner/status must
-- be evaluated by the server before it can be reclaimed.
alter table public.slug_reservations
  add column if not exists expires_at timestamptz,
  add column if not exists order_id text;

create index if not exists slug_reservations_expires_idx
  on public.slug_reservations (expires_at)
  where expires_at is not null;

create index if not exists slug_reservations_order_idx
  on public.slug_reservations (order_id)
  where order_id is not null;

comment on column public.slug_reservations.expires_at is
  'Server-derived draft or unpaid-checkout hold expiry; published gifts are never reclaimed.';
comment on column public.slug_reservations.order_id is
  'The checkout order that owns a temporary hold, when applicable.';
