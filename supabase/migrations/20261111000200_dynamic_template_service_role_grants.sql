-- The dynamic-template API uses the server-only Supabase service_role client.
-- Grant only the table operations used by the admin routes; RLS remains enabled.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.dynamic_templates to service_role;
