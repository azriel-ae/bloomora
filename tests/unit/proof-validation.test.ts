import assert from 'node:assert/strict';
import test from 'node:test';
import { proofSignatureMatches } from '../../lib/server/proof-validation.ts';

test('payment proof validation requires a matching file signature', () => {
  assert.equal(proofSignatureMatches('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(proofSignatureMatches('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(proofSignatureMatches('image/webp', new TextEncoder().encode('RIFFxxxxWEBP')), true);
  assert.equal(proofSignatureMatches('application/pdf', new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(proofSignatureMatches('image/jpeg', new TextEncoder().encode('%PDF-1.7')), false);
  assert.equal(proofSignatureMatches('application/pdf', new TextEncoder().encode('not a proof')), false);
  assert.equal(proofSignatureMatches('image/svg+xml', new TextEncoder().encode('<svg>')), false);
});
