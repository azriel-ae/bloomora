import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { parseManifest, parseZip, validateFiles } from '../../lib/server/dynamic-template-validation.ts';

const manifest = JSON.stringify({ name: { en: 'A Letter', id: 'Sebuah Surat' }, category: 'special-moments', renderer: 'custom-html', entryPoint: 'index.html' });

test('dynamic template accepts a valid manifest and entry point', () => {
  const files = [{ path: 'manifest.json', bytes: new TextEncoder().encode(manifest), contentType: 'application/json' }, { path: 'index.html', bytes: new TextEncoder().encode('<h1>Hello</h1>'), contentType: 'text/html' }];
  assert.equal(parseManifest(files).entryPoint, 'index.html');
});

test('dynamic template rejects missing manifest and entry point', () => {
  const manifestOnly = [{ path: 'manifest.json', bytes: new TextEncoder().encode(manifest), contentType: 'application/json' }];
  assert.throws(() => parseManifest(manifestOnly), /entry_point_missing/);
  assert.throws(() => parseManifest([{ path: 'index.html', bytes: new Uint8Array(), contentType: 'text/html' }]), /manifest_missing/);
});

test('dynamic template rejects traversal and dangerous files', () => {
  assert.throws(() => validateFiles([{ path: '../secret.js', bytes: new Uint8Array(1), contentType: 'text/javascript' }]), /unsupported_path/);
  assert.throws(() => validateFiles([{ path: 'install.sh', bytes: new Uint8Array(1), contentType: 'text/plain' }]), /unsupported_path/);
});

test('dynamic template parses ZIP without executing its content', () => {
  const bytes = zipSync({ 'manifest.json': new TextEncoder().encode(manifest), 'index.html': new TextEncoder().encode('<script>window.executed=true</script>') });
  const files = parseZip(bytes);
  assert.deepEqual(files.map((file) => file.path).sort(), ['index.html', 'manifest.json']);
  assert.match(new TextDecoder().decode(files.find((file) => file.path === 'index.html')!.bytes), /window.executed/);
});
