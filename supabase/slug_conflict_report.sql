-- Read-only diagnostic for a reported slug. Replace the value below and run in Supabase SQL Editor.
-- This intentionally does not delete or update any record.
with requested as (select lower(trim('davidddddaa'))::text as slug)
select
  r.slug,
  r.gift_id as reservation_gift_id,
  r.owner_uid as reservation_owner_uid,
  r.created_at as reservation_created_at,
  r.expires_at as reservation_expires_at,
  r.order_id as reservation_order_id,
  g.status as gift_status,
  g.published_revision,
  g.created_at as gift_created_at,
  g.updated_at as gift_updated_at,
  o.id as order_id,
  o.status as order_status,
  o.created_at as order_created_at,
  o.deleted_at as order_deleted_at,
  case
    when g.published_revision is not null and g.status <> 'deleted' then 'published_or_previously_published_keep'
    when g.status = 'deleted' then 'deleted_reclaimable_by_server'
    when o.status in ('approved', 'proof_submitted') and o.deleted_at is null then 'active_order_keep'
    when o.status = 'awaiting_payment' and o.deleted_at is null and o.created_at > now() - interval '48 hours' then 'active_unpaid_hold_keep'
    when o.id is null or o.status in ('cancelled', 'rejected') or o.created_at <= now() - interval '48 hours' then 'stale_or_reclaimable'
    else 'review_server_rules'
  end as server_disposition
from requested q
left join public.slug_reservations r on r.slug = q.slug
left join public.gifts g on g.id = r.gift_id
left join public.orders o on o.gift_id = r.gift_id
order by o.created_at desc nulls last;

-- Optional inventory view: legacy reservations whose owner is a non-published draft
-- and has no active checkout hold. Review the result before any manual action.
select r.slug, r.gift_id, r.owner_uid, r.created_at, r.expires_at
from public.slug_reservations r
join public.gifts g on g.id = r.gift_id
where g.status = 'draft'
  and g.published_revision is null
  and not exists (
    select 1 from public.orders o
    where o.gift_id = r.gift_id
      and o.deleted_at is null
      and (
        o.status in ('approved', 'proof_submitted')
        or (o.status = 'awaiting_payment' and o.created_at > now() - interval '48 hours')
      )
  )
order by r.created_at asc;
