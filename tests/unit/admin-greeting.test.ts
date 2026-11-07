import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminGreeting } from '../../lib/admin-greeting.ts';

test('admin greeting follows the local hour across all day periods', () => {
  assert.equal(getAdminGreeting(4), 'Selamat pagi, Bloomora.');
  assert.equal(getAdminGreeting(10), 'Selamat pagi, Bloomora.');
  assert.equal(getAdminGreeting(11), 'Selamat siang, Bloomora.');
  assert.equal(getAdminGreeting(14), 'Selamat siang, Bloomora.');
  assert.equal(getAdminGreeting(15), 'Selamat sore, Bloomora.');
  assert.equal(getAdminGreeting(18), 'Selamat sore, Bloomora.');
  assert.equal(getAdminGreeting(19), 'Selamat malam, Bloomora.');
  assert.equal(getAdminGreeting(3), 'Selamat malam, Bloomora.');
  assert.equal(getAdminGreeting(-1), 'Selamat datang, Bloomora.');
  assert.equal(getAdminGreeting(24), 'Selamat datang, Bloomora.');
});
