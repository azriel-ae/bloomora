-- Soft-delete orders without changing payment/review state or linked records.
alter table public.orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_uid text;

comment on column public.orders.deleted_at is 'Soft-delete timestamp; historical order state and linked records are retained.';
comment on column public.orders.deleted_by_uid is 'Actor UID initiating soft-delete; guest orders use their synthetic owner UID.';
