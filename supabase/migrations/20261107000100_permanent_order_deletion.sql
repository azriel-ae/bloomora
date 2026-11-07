begin;

-- Permanently deleting an order must not silently revoke an already-paid subscription.
-- Keep the entitlement and detach its source-order reference instead.
alter table public.subscriptions alter column order_id drop not null;
alter table public.subscriptions drop constraint if exists subscriptions_order_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_order_id_fkey foreign key (order_id)
  references public.orders(id) on delete set null;

-- Preserve one-time payment/proof hashes as anti-fraud claims while removing customer order data.
alter table public.payment_transaction_claims alter column order_id drop not null;
alter table public.payment_transaction_claims drop constraint if exists payment_transaction_claims_order_id_fkey;
alter table public.payment_transaction_claims
  add constraint payment_transaction_claims_order_id_fkey foreign key (order_id)
  references public.orders(id) on delete set null;
alter table public.payment_proof_claims alter column order_id drop not null;
alter table public.payment_proof_claims drop constraint if exists payment_proof_claims_order_id_fkey;
alter table public.payment_proof_claims
  add constraint payment_proof_claims_order_id_fkey foreign key (order_id)
  references public.orders(id) on delete set null;

-- Related ephemeral access/idempotency and private gift rows are removed with their parent.
alter table public.guest_order_idempotency drop constraint if exists guest_order_idempotency_order_id_fkey;
alter table public.guest_order_idempotency
  add constraint guest_order_idempotency_order_id_fkey foreign key (order_id)
  references public.orders(id) on delete cascade;
alter table public.guest_order_idempotency drop constraint if exists guest_order_idempotency_gift_id_fkey;
alter table public.guest_order_idempotency
  add constraint guest_order_idempotency_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete cascade;

alter table public.guest_edit_links drop constraint if exists guest_edit_links_order_id_fkey;
alter table public.guest_edit_links
  add constraint guest_edit_links_order_id_fkey foreign key (order_id)
  references public.orders(id) on delete cascade;
alter table public.guest_edit_links drop constraint if exists guest_edit_links_gift_id_fkey;
alter table public.guest_edit_links
  add constraint guest_edit_links_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete cascade;

alter table public.guest_edit_recoveries drop constraint if exists guest_edit_recoveries_gift_id_fkey;
alter table public.guest_edit_recoveries
  add constraint guest_edit_recoveries_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete cascade;
alter table public.gift_revisions drop constraint if exists gift_revisions_gift_id_fkey;
alter table public.gift_revisions
  add constraint gift_revisions_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete cascade;
alter table public.gift_media drop constraint if exists gift_media_gift_id_fkey;
alter table public.gift_media
  add constraint gift_media_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete cascade;

-- Keep deleted public slugs permanently unavailable so a stale /g/<slug> can never resolve to
-- a different customer's gift after deletion. Clear all associations to the deleted gift.
alter table public.slug_reservations alter column gift_id drop not null;
alter table public.slug_reservations alter column owner_uid drop not null;
alter table public.slug_reservations drop constraint if exists slug_reservations_gift_id_fkey;
alter table public.slug_reservations
  add constraint slug_reservations_gift_id_fkey foreign key (gift_id)
  references public.gifts(id) on delete set null deferrable initially deferred;

comment on column public.subscriptions.order_id is
  'Nullable when the source order was permanently deleted; paid entitlement remains active until expiry or revocation.';
comment on column public.slug_reservations.gift_id is
  'Null for a permanently deleted gift; the slug remains reserved to prevent stale public-link reuse.';

commit;
