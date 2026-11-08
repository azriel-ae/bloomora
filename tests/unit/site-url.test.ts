import assert from 'node:assert/strict';
import test from 'node:test';
import { SITE_ORIGIN, siteUrl } from '../../lib/site-url.ts';

test('all generated public URLs use the official HTTPS Bloomora origin', () => {
  assert.equal(SITE_ORIGIN, 'https://bloomora.my.id');
  assert.equal(siteUrl('/g/hadiah-unik'), 'https://bloomora.my.id/g/hadiah-unik');
  assert.equal(siteUrl('/edit/token-aman'), 'https://bloomora.my.id/edit/token-aman');
  assert.equal(siteUrl('/recover/edit?token=abc'), 'https://bloomora.my.id/recover/edit?token=abc');
});
