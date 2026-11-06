-- Store optional Gemini extraction separately from upload metadata and reserve
-- normalized transaction IDs uniquely before a rule-gated automatic approval.
-- No existing orders are approved or changed by this migration.

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
