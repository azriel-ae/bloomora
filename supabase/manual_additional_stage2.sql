-- Bloomora Tahap 2 — tambahan migration yang perlu dijalankan jika belum ada.
-- Jalankan file ini di Supabase Dashboard -> SQL Editor.
-- Aman dijalankan ulang: tidak menghapus tabel, kolom, index, atau data.
-- Pastikan project Supabase yang dipilih adalah project Bloomora yang dipakai runtime.

begin;

-- Payment-proof AI metadata dan claim tables.
-- Tidak menyetujui order lama dan tidak mengubah status pembayaran.
alter table public.orders
  add column if not exists proof_ai_verification jsonb
  check (proof_ai_verification is null or jsonb_typeof(proof_ai_verification) = 'object');

create table if not exists public.payment_transaction_claims (
  transaction_hash text primary key check (transaction_hash ~ '^[a-f0-9]{64}$'),
  order_id text not null unique references public.orders(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists payment_transaction_claims_order_idx
  on public.payment_transaction_claims (order_id);

create table if not exists public.payment_proof_claims (
  file_hash text primary key check (file_hash ~ '^[a-f0-9]{64}$'),
  order_id text not null unique references public.orders(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists payment_proof_claims_order_idx
  on public.payment_proof_claims (order_id);

alter table public.payment_transaction_claims enable row level security;
revoke all on table public.payment_transaction_claims from public, anon, authenticated;
alter table public.payment_proof_claims enable row level security;
revoke all on table public.payment_proof_claims from public, anon, authenticated;

-- Checkout lifecycle memakai dua kolom ini untuk reclaim draft lama dan unpaid hold.
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
  'Checkout order holding this slug; used to reclaim expired unpaid holds safely.';

commit;

-- Verifikasi: hasil harus memuat expires_at dan order_id.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'slug_reservations'
  and column_name in ('expires_at', 'order_id')
order by column_name;

-- Verifikasi index lifecycle.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'slug_reservations'
  and indexname in ('slug_reservations_expires_idx', 'slug_reservations_order_idx')
order by indexname;

-- Verifikasi payment-proof AI/claims.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name = 'proof_ai_verification';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('payment_transaction_claims', 'payment_proof_claims')
order by table_name;
