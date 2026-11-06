-- READ-ONLY Payment Method schema diagnosis for Supabase SQL Editor.
-- This file contains SELECT statements only; it does not alter schema, policies, buckets, or data.
-- Run as a project administrator, then share the result grids (no secrets or payment data are queried).

-- 1) Confirm which target tables exist in the expected schema.
select table_schema, table_name, table_type
from information_schema.tables
where (table_schema = 'public' and table_name in ('payment_methods', 'admin_audit_logs'))
   or (table_schema = 'storage' and table_name in ('buckets', 'objects'))
order by table_schema, table_name;

-- 2) Compare every column written/read for Payment Method with the repository contract.
-- A missing row or unexpected actual_type/nullability/default is the relevant schema evidence.
with expected(column_name, expected_type, expected_nullable, purpose) as (
  values
    ('id', 'text', 'NO', 'primary key'),
    ('name', 'text', 'NO', 'display name'),
    ('instructions', 'text', 'NO', 'optional instructions stored as empty string when blank'),
    ('image_url', 'text', 'YES', 'optional public image URL'),
    ('image_path', 'text', 'YES', 'optional Storage object path'),
    ('active', 'boolean', 'NO', 'active checkout flag'),
    ('sort_order', 'integer', 'NO', 'display order'),
    ('updated_by', 'text', 'YES', 'server-authenticated actor UID'),
    ('created_at', 'timestamp with time zone', 'NO', 'creation timestamp'),
    ('updated_at', 'timestamp with time zone', 'NO', 'update timestamp'),
    ('schema_version', 'integer', 'NO', 'document schema version'),
    ('payment_type', 'text', 'NO', 'bank_transfer/e_wallet/qris/other'),
    ('provider_name', 'text', 'YES', 'bank or e-wallet provider'),
    ('account_number', 'text', 'YES', 'bank account or e-wallet phone/account'),
    ('account_holder', 'text', 'YES', 'account holder; optional for e-wallet/QRIS'),
    ('qris_detection_status', 'text', 'NO', 'administrative QRIS status, not payment verification')
)
select
  e.column_name,
  e.expected_type,
  e.expected_nullable,
  e.purpose,
  c.data_type as actual_type,
  c.udt_name as actual_udt,
  c.is_nullable as actual_nullable,
  c.column_default as actual_default,
  case
    when c.column_name is null then 'MISSING'
    when c.data_type <> e.expected_type then 'TYPE_MISMATCH'
    when c.is_nullable <> e.expected_nullable then 'NULLABILITY_MISMATCH'
    else 'present; compare default and constraints'
  end as diagnosis
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'payment_methods'
 and c.column_name = e.column_name
order by e.column_name;

-- 3) Show the actual columns for BOTH tables written in the same Save transaction.
-- If payment_methods is correct but this table is missing a mapped column, the UI may
-- previously have mislabeled that separate failure as payment_method_schema_outdated.
select table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name in ('payment_methods', 'admin_audit_logs')
order by table_name, ordinal_position;

-- 4) Show actual PK/FK/UNIQUE/CHECK constraints, including whether PostgreSQL validated them.
select
  ns.nspname as schema_name,
  tbl.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  con.convalidated as is_validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class tbl on tbl.oid = con.conrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
where ns.nspname = 'public'
  and tbl.relname in ('payment_methods', 'admin_audit_logs')
order by tbl.relname, con.conname;

-- 5) Check RLS flags and effective table privileges (must not grant writes to anon/PUBLIC).
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in ('payment_methods', 'admin_audit_logs'))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by n.nspname, c.relname;

select role_name, privilege,
       case when to_regclass('public.payment_methods') is null then null
            else has_table_privilege(role_name, to_regclass('public.payment_methods'), privilege)
       end as effective_payment_method_privilege
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as privileges(privilege)
order by role_name, privilege;

select grantee, table_schema, table_name, privilege_type, is_grantable
from information_schema.role_table_grants
where (table_schema = 'public' and table_name = 'payment_methods')
   or (table_schema = 'storage' and table_name = 'objects')
order by table_schema, table_name, grantee, privilege_type;

-- 6) Show active policies that PostgreSQL will combine for the target tables.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('payment_methods', 'admin_audit_logs'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 7) Show the actual Payment Method image bucket and its limits; do not query object contents.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'payment-method-images';

-- 8) Migration-history availability only. Supabase projects may not expose this history table
-- to SQL Editor; an empty result here does not prove migrations were or were not applied.
select table_schema, table_name
from information_schema.tables
where table_schema in ('supabase_migrations', 'supabase')
  and table_name in ('schema_migrations', 'migrations')
order by table_schema, table_name;
