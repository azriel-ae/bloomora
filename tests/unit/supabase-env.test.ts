import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasSupabaseDatabaseConfig,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
  supabaseDatabaseUrl,
  supabasePublicConfig,
  supabaseServiceRoleKey,
} from '../../lib/env.ts';

const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));

test('Supabase env helpers validate public URL, separate privileged key, and accept PostgreSQL URI only', () => {
  try {
    for (const key of keys) delete process.env[key];
    assert.deepEqual(supabasePublicConfig(), { url: null, anonKey: null });
    assert.equal(hasSupabasePublicConfig(), false);
    assert.equal(hasSupabaseServiceRoleConfig(), false);
    assert.equal(hasSupabaseDatabaseConfig(), false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
    assert.equal(hasSupabasePublicConfig(), true);
    assert.equal(hasSupabaseServiceRoleConfig(), false);

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
    assert.equal(hasSupabaseServiceRoleConfig(), true);
    assert.equal(supabaseServiceRoleKey(), 'server-only-test-key');

    process.env.SUPABASE_DB_URL = 'postgresql://app:secret@db.example.test:5432/postgres';
    assert.equal(hasSupabaseDatabaseConfig(), true);
    assert.equal(supabaseDatabaseUrl(), process.env.SUPABASE_DB_URL);
    process.env.SUPABASE_DB_URL = 'https://not-a-database.example.test';
    assert.equal(hasSupabaseDatabaseConfig(), false);
    assert.equal(supabaseDatabaseUrl(), null);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'javascript:alert(1)';
    assert.equal(hasSupabasePublicConfig(), false);
    assert.equal(hasSupabaseServiceRoleConfig(), false);
  } finally {
    for (const key of keys) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
