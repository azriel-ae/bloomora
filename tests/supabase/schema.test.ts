import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrationPaths = [
  'supabase/migrations/20261103000100_initial_schema.sql',
  'supabase/migrations/20261104000100_customer_media_storage.sql',
  'supabase/migrations/20261104000200_payment_method_details.sql',
  'supabase/migrations/20261104000300_payment_method_authenticated_management.sql',
  'supabase/migrations/20261104000400_order_soft_delete.sql',
  'supabase/migrations/20261105000100_payment_method_admin_only.sql',
  'supabase/migrations/20261105000200_payment_proof_ai_review.sql',
];
const testUid = '00000000-0000-4000-8000-000000000001';
const nonAdminUid = '00000000-0000-4000-8000-000000000002';
const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  grant usage on schema storage to anon, authenticated;
  create table storage.buckets (
    id text primary key, name text not null, public boolean not null default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id text primary key, bucket_id text not null, name text not null);
  alter table storage.objects enable row level security;
`;

async function applyMigrations(database: PGlite) {
  await database.exec(bootstrapSql);
  for (const path of migrationPaths) await database.exec(await readFile(resolve(process.cwd(), path), 'utf8'));
  await database.exec(await readFile(resolve(process.cwd(), migrationPaths[3]), 'utf8'));
  await database.exec(await readFile(resolve(process.cwd(), migrationPaths[5]), 'utf8'));
}

test('Supabase schema grants payment-method management to admins/owners only', async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);

    const tables = await database.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
    );
    assert.equal(tables.rows.length, 19);
    const proofAiColumn = await database.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'proof_ai_verification'");
    assert.deepEqual(proofAiColumn.rows.map((row) => row.column_name), ['proof_ai_verification']);
    const orderDeleteColumns = await database.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name in ('deleted_at', 'deleted_by_uid') order by column_name");
    assert.deepEqual(orderDeleteColumns.rows.map((row) => row.column_name), ['deleted_at', 'deleted_by_uid']);

    const columns = await database.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'payment_methods' and column_name in ('payment_type', 'provider_name', 'account_number', 'account_holder', 'qris_detection_status') order by column_name",
    );
    assert.deepEqual(columns.rows.map((row) => row.column_name), [
      'account_holder', 'account_number', 'payment_type', 'provider_name', 'qris_detection_status',
    ]);

    const bucket = await database.query<{ public: boolean; file_size_limit: number }>(
      "select public, file_size_limit from storage.buckets where id = 'payment-method-images'",
    );
    assert.equal(bucket.rows.length, 1);
    assert.equal(bucket.rows[0].public, true);
    assert.equal(Number(bucket.rows[0].file_size_limit), 5 * 1024 * 1024);

    await database.exec(`
      insert into public.public_gifts (slug, status, template_id, template_version, revision, content, published_at)
      values
        ('published-example', 'published', 'core-one', 1, 1, '{"fields":{},"sections":[],"data":{},"media":[]}', now()),
        ('archived-example', 'archived', 'core-one', 1, 1, '{"fields":{},"sections":[],"data":{},"media":[]}', now());
      insert into public.payment_methods (id, name, instructions, active, payment_type)
      values ('active-qris', 'QRIS', '', true, 'qris'), ('inactive-bank', 'Old bank', '', false, 'bank_transfer');
      insert into auth.users (id) values ('${testUid}');
      insert into public.admin_profiles (user_id, role) values ('${testUid}', 'owner');
    `);

    await database.exec('set role anon');
    const publicRows = await database.query<{ slug: string }>('select slug from public.public_gifts order by slug');
    assert.deepEqual(publicRows.rows.map((row) => row.slug), ['published-example']);
    const publicMethods = await database.query<{ id: string }>('select id from public.payment_methods order by id');
    assert.deepEqual(publicMethods.rows.map((row) => row.id), ['active-qris']);
    await assert.rejects(
      database.query("insert into public.payment_methods (id, name, active, payment_type) values ('anon-method', 'No', true, 'qris')"),
      /permission denied/i,
    );
    await assert.rejects(
      database.query("insert into storage.objects (id, bucket_id, name) values ('anon-image', 'payment-method-images', 'payment-methods/anon/x.png')"),
      /permission denied/i,
    );
    await assert.rejects(database.query('select id from public.gifts'), /permission denied/i);
    await assert.rejects(
      database.query("insert into public.public_gifts (slug, status, template_id, template_version, revision, content) values ('client-write', 'published', 'core-one', 1, 1, '{}')"),
      /permission denied/i,
    );

    await database.exec(`reset role; select set_config('request.jwt.claim.sub', '${testUid}', false); set role authenticated`);
    const ownProfile = await database.query<{ role: string }>('select role from public.admin_profiles');
    assert.deepEqual(ownProfile.rows.map((row) => row.role), ['owner']);
    await database.exec(`select set_config('request.jwt.claim.sub', '${nonAdminUid}', false)`);
    const noRoleProfile = await database.query<{ role: string }>('select role from public.admin_profiles');
    assert.deepEqual(noRoleProfile.rows, []);
    const managedMethods = await database.query<{ id: string }>('select id from public.payment_methods order by id');
    assert.deepEqual(managedMethods.rows.map((row) => row.id), ['active-qris']);
    await assert.rejects(
      database.query("insert into public.payment_methods (id, name, instructions, active, payment_type) values ('staff-qris', 'No', '', true, 'qris')"),
      /row-level security/i,
    );
    await assert.rejects(
      database.query(`insert into storage.objects (id, bucket_id, name) values ('staff-image', 'payment-method-images', 'payment-methods/${nonAdminUid}/image.png')`),
      /row-level security/i,
    );

    await database.exec(`select set_config('request.jwt.claim.sub', '${testUid}', false)`);
    const adminMethods = await database.query<{ id: string }>('select id from public.payment_methods order by id');
    assert.deepEqual(adminMethods.rows.map((row) => row.id), ['active-qris', 'inactive-bank']);
    await database.query("insert into public.payment_methods (id, name, instructions, active, payment_type) values ('auth-qris', 'QRIS without account number', '', true, 'qris')");
    await database.query("update public.payment_methods set active = false where id = 'inactive-bank'");
    await database.query("delete from public.payment_methods where id = 'auth-qris'");
    await database.query(`insert into storage.objects (id, bucket_id, name) values ('auth-image', 'payment-method-images', 'payment-methods/${testUid}/image.png')`);
    const ownImage = await database.query<{ name: string }>("select name from storage.objects where id = 'auth-image'");
    assert.equal(ownImage.rows[0].name, `payment-methods/${testUid}/image.png`);
    await database.query(`update storage.objects set name = 'payment-methods/${testUid}/updated.png' where id = 'auth-image'`);
    await database.query("delete from storage.objects where id = 'auth-image'");
    await assert.rejects(
      database.query("insert into storage.objects (id, bucket_id, name) values ('foreign-image', 'payment-method-images', 'payment-methods/00000000-0000-4000-8000-000000000099/image.png')"),
      /row-level security/i,
    );
    await database.exec('reset role');
    await database.exec(await readFile(resolve(process.cwd(), 'supabase/diagnostics/diagnose_payment_method_schema.sql'), 'utf8'));
  } finally {
    await database.close();
  }
});

test('consolidated manual SQL replays safely and links only the explicitly selected existing Auth user', async () => {
  const database = new PGlite();
  try {
    await database.exec(bootstrapSql);
    const bundle = await readFile(resolve(process.cwd(), 'supabase/manual_apply_all_migrations.sql'), 'utf8');
    await database.exec(bundle);
    await database.exec("insert into public.payment_methods (id, name, instructions, active, payment_type) values ('kept-qris', 'Existing QRIS', '', true, 'qris')");
    await database.exec("update public.packages set price_idr = 424242 where id = 'basic'");
    await database.exec(bundle);

    const method = await database.query<{ name: string; payment_type: string; instructions: string }>(
      "select name, payment_type, instructions from public.payment_methods where id = 'kept-qris'",
    );
    assert.deepEqual(method.rows, [{ name: 'Existing QRIS', payment_type: 'qris', instructions: '' }]);
    const packageRow = await database.query<{ price_idr: number }>("select price_idr from public.packages where id = 'basic'");
    assert.equal(Number(packageRow.rows[0].price_idr), 424242);

    const methodPolicies = await database.query<{ count: number }>(
      "select count(*)::int as count from pg_policies where schemaname = 'public' and tablename = 'payment_methods'",
    );
    assert.equal(methodPolicies.rows[0].count, 5);
    const storagePolicies = await database.query<{ count: number }>(
      "select count(*)::int as count from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'payment_method_images_admin_%'",
    );
    assert.equal(storagePolicies.rows[0].count, 4);

    const profilesBeforeOptIn = await database.query<{ count: number }>('select count(*)::int as count from public.admin_profiles');
    assert.equal(profilesBeforeOptIn.rows[0].count, 0);
    await database.exec('alter table auth.users add column email text');
    await database.exec("insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000099', 'admin@example.com')");
    const configuredBundle = bundle.replace("set local bloomora.admin_email = '';", "set local bloomora.admin_email = 'admin@example.com';");
    assert.notEqual(configuredBundle, bundle);
    await database.exec(configuredBundle);
    const adminProfile = await database.query<{ role: string }>(
      "select role from public.admin_profiles where user_id = '00000000-0000-4000-8000-000000000099'",
    );
    assert.deepEqual(adminProfile.rows, [{ role: 'admin' }]);
    await database.exec("update public.admin_profiles set role = 'owner' where user_id = '00000000-0000-4000-8000-000000000099'");
    await database.exec(configuredBundle);
    const retainedOwnerProfile = await database.query<{ role: string }>(
      "select role from public.admin_profiles where user_id = '00000000-0000-4000-8000-000000000099'",
    );
    assert.deepEqual(retainedOwnerProfile.rows, [{ role: 'owner' }]);
  } finally {
    await database.close();
  }
});
