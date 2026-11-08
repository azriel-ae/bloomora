-- Bloomora payment method details extension.
-- Run manually in Supabase SQL Editor after 20261103000100_initial_schema.sql.
-- Additive and idempotent: preserves existing payment methods and transaction snapshots.

alter table public.payment_methods
  add column if not exists payment_type text not null default 'other'
    check (payment_type in ('bank_transfer', 'e_wallet', 'qris', 'other')),
  add column if not exists provider_name text,
  add column if not exists account_number text,
  add column if not exists account_holder text,
  add column if not exists qris_detection_status text not null default 'not_checked'
    check (qris_detection_status in ('not_checked', 'needs_confirmation', 'confirmed'));

create index if not exists payment_methods_active_order_idx
  on public.payment_methods (active, sort_order, created_at, id);

comment on column public.payment_methods.qris_detection_status is
  'Never implies QRIS validity unless an administrator confirms a decoded payload.';
