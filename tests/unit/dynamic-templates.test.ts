import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { classifyDynamicTemplateDatabaseError } from '../../lib/server/dynamic-template-errors.ts';
import { analyzeTemplateFiles, parseManifest, parseZip, validateFiles, validateManifestForAnalysis, type TemplateUploadFile } from '../../lib/server/dynamic-template-validation.ts';
import { createDynamicTemplateVersionSnapshot, dynamicVersionToTemplateInfo, hashDynamicTemplateBundle, hashDynamicTemplateManifest, missingRequiredDynamicTemplateFields, validateDynamicTemplateValues, validateDynamicTemplateManifest } from '../../lib/server/dynamic-template-contract.ts';

const file = (path: string, text: string, contentType = 'application/octet-stream'): TemplateUploadFile => ({ path, bytes: new TextEncoder().encode(text), contentType });
const legacyManifest = JSON.stringify({ name: { en: 'A Letter', id: 'Sebuah Surat' }, category: 'special-moments', renderer: 'custom-html', entryPoint: 'index.html' });

test('legacy manifest parser validates a declared entry point', () => {
  const files = [file('manifest.json', legacyManifest, 'application/json'), file('index.html', '<h1>Hello</h1>', 'text/html')];
  assert.equal(parseManifest(files).entryPoint, 'index.html');
  assert.equal(parseManifest(files).compatibility.customerReady, false);
});

test('manifest parser rejects missing manifest and entry point', () => {
  const manifestOnly = [file('manifest.json', legacyManifest, 'application/json')];
  assert.throws(() => parseManifest(manifestOnly), /entry_point_missing/);
  assert.throws(() => parseManifest([file('index.html', '<h1>Hello</h1>', 'text/html')]), /manifest_missing/);
});

test('path validation rejects traversal, executable files, duplicate paths, and mismatched MIME', () => {
  assert.throws(() => validateFiles([file('../secret.js', 'bad')]), /unsupported_path/);
  assert.throws(() => validateFiles([file('install.sh', 'bad')]), /unsupported_path/);
  assert.throws(() => validateFiles([file('index.html', 'a'), file('index.html', 'b')]), /duplicate_path/);
  assert.throws(() => validateFiles([file('index.html', '<h1>x</h1>', 'image/png')]), /mime_mismatch/);
});

test('ZIP extraction accepts HTML and assets without requiring a manifest', () => {
  const bytes = zipSync({ 'gift/index.html': new TextEncoder().encode('<h1>Surat untuk kamu</h1>'), 'gift/css/main.css': new TextEncoder().encode('body { color: #333 }'), 'gift/images/cover.png': new Uint8Array([1, 2, 3]) });
  const files = parseZip(bytes);
  assert.deepEqual(files.map((item) => item.path).sort(), ['gift/css/main.css', 'gift/images/cover.png', 'gift/index.html']);
  const result = analyzeTemplateFiles(files);
  assert.equal(result.analysis.format, 'html');
  assert.equal(result.analysis.entryPoint, 'gift/index.html');
  assert.equal(result.manifest.renderer, 'custom-html');
  assert.equal(result.manifest.slug, 'surat-untuk-kamu');
  assert.equal(result.manifest.compatibility.customerReady, false);
});

test('HTML analyzer detects local assets, external resources, and missing local files', () => {
  const files = [
    file('index.html', '<!doctype html><html lang="id"><head><title>Garden Letter</title><link rel="stylesheet" href="styles/main.css"><script src="app.js"></script></head><body><img src="images/cover.jpg"><img src="missing.png"><img src="https://cdn.example.test/photo.webp"><input data-bloomora-field="recipientName" aria-label="Nama penerima"></body></html>', 'text/html'),
    file('styles/main.css', 'body { background: url("../images/bg.webp") center/cover }'),
    file('app.js', 'document.querySelector("button")?.addEventListener("click", () => {});', 'text/javascript'),
    file('images/cover.jpg', 'image bytes', 'image/jpeg'),
    file('images/bg.webp', 'image bytes', 'image/webp'),
  ];
  const result = analyzeTemplateFiles(files);
  assert.equal(result.analysis.language, 'id');
  assert.ok(result.analysis.dependencies.local.includes('styles/main.css'));
  assert.ok(result.analysis.dependencies.local.includes('app.js'));
  assert.ok(result.analysis.dependencies.local.includes('images/cover.jpg'));
  assert.ok(result.analysis.dependencies.external.includes('https://cdn.example.test/photo.webp'));
  assert.ok(result.analysis.dependencies.missing.some((item) => item.includes('missing.png')));
  assert.deepEqual(result.analysis.editableFields, [{ key: 'recipientName', label: 'Nama penerima', type: 'text' }]);
  assert.equal(result.manifest.configurationSchema.fields[0]?.key, 'recipientName');
  assert.equal(result.manifest.requirements[0], 'https://cdn.example.test/photo.webp');
});

test('React/TSX source is identified but not treated as executable HTML', () => {
  const result = analyzeTemplateFiles([file('src/App.tsx', 'export default function App() { return <div />; }', 'application/typescript')]);
  assert.equal(result.analysis.format, 'react');
  assert.ok(result.analysis.errors.includes('react_build_worker_unavailable'));
  assert.equal(result.analysis.entryPoint, null);
});

test('bare npm imports are identified as unbundled and block preview readiness', () => {
  const files = [file('index.html', '<html><head><title>Bundle</title><script type="module" src="app.js"></script></head><body></body></html>', 'text/html'), file('app.js', "import React from 'react';")];
  const result = analyzeTemplateFiles(files);
  assert.ok(result.analysis.dependencies.external.includes('npm:react'));
  assert.ok(result.analysis.errors.includes('unbundled_package_dependencies'));
});

test('admin edits cannot change renderer or claim unobserved editor fields/features', () => {
  const files = [file('index.html', '<html><head><title>Little Letter</title></head><body><p data-bloomora-field="message">Hi</p></body></html>', 'text/html')];
  const result = analyzeTemplateFiles(files);
  const invalidFeature = { ...result.manifest, supportedFeatures: [...result.manifest.supportedFeatures, 'music'] };
  assert.throws(() => validateManifestForAnalysis(invalidFeature, result.analysis, files), /unsupported_feature_claim/);
  const invalidEditor = { ...result.manifest, configurationSchema: { fields: [...result.manifest.configurationSchema.fields, { key: 'photo', label: 'Photo', type: 'text' }] } };
  assert.throws(() => validateManifestForAnalysis(invalidEditor, result.analysis, files), /unsupported_editor_field_claim/);
  const wrongRenderer = { ...result.manifest, renderer: 'custom-react' };
  assert.throws(() => validateManifestForAnalysis(wrongRenderer, result.analysis, files), /renderer_detection_mismatch/);
  assert.throws(() => validateManifestForAnalysis({ ...result.manifest, schemaVersion: 99 }, result.analysis, files), /unsupported_manifest_schema_version/);
  assert.throws(() => validateManifestForAnalysis({ ...result.manifest, configurationSchema: { fields: [{ ...result.manifest.configurationSchema.fields[0]!, defaultValue: 'x'.repeat(2500) }] } }, result.analysis, files), /unsupported_editor_field_claim/);
});

test('customer values are plain declared fields with server-enforced defaults and limits', () => {
  const files = [file('index.html', '<textarea data-bloomora-field="message" data-bloomora-label="Pesan">Default</textarea><input data-bloomora-field="recipientName" maxlength="80">', 'text/html')];
  const { manifest } = analyzeTemplateFiles(files);
  const validated = validateManifestForAnalysis(manifest, analyzeTemplateFiles(files).analysis, files);
  assert.deepEqual(validateDynamicTemplateValues(validated, { recipientName: 'Ari' }), { message: '', recipientName: 'Ari' });
  assert.throws(() => validateDynamicTemplateValues(validated, { undeclared: 'value' }), /dynamic_field_not_allowed/);
  assert.throws(() => validateDynamicTemplateValues(validated, { message: 42 }), /dynamic_field_type_invalid/);
  assert.throws(() => validateDynamicTemplateValues(validated, { recipientName: 'x'.repeat(201) }), /dynamic_field_too_long/);
  const required = validateDynamicTemplateManifest({ ...validated, configurationSchema: { fields: validated.configurationSchema.fields.map((field) => ({ ...field, required: field.key === 'message' })) } });
  assert.deepEqual(validateDynamicTemplateValues(required, {}), { message: '', recipientName: '' }, 'incomplete Drafts remain valid');
  assert.deepEqual(missingRequiredDynamicTemplateFields(required, {}), ['message']);
  assert.deepEqual(missingRequiredDynamicTemplateFields(required, { message: 'Done' }), []);
});

test('immutable version snapshot pins versioned manifest, entry point, assets and deterministic bundle checksum', () => {
  const files = [file('index.html', '<h1>Hello</h1>', 'text/html'), file('assets/style.css', 'h1 { color: green }', 'text/css')];
  const manifest = analyzeTemplateFiles(files).manifest;
  const snapshot = createDynamicTemplateVersionSnapshot({ manifest, files, sourcePath: 'letters/v1/source', publishedAt: '2026-01-02T03:04:05.000Z' });
  assert.equal(snapshot.templateId, manifest.id);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.entryPoint, 'index.html');
  assert.equal(snapshot.bundleSha256.length, 64);
  const templateInfo = dynamicVersionToTemplateInfo(snapshot);
  assert.equal(templateInfo.id, snapshot.templateId);
  assert.equal(templateInfo.version, snapshot.version);
  assert.equal(templateInfo.tier, 'core');
  assert.equal(templateInfo.validateContent?.({ fields: {}, sections: [], data: {}, media: [] }), null);
  assert.equal(templateInfo.validateContent?.({ fields: { unsafe: 'x' }, sections: [], data: {}, media: [] }), 'dynamic_field_not_allowed');
  assert.equal(hashDynamicTemplateBundle(manifest, [...files].reverse()), snapshot.bundleSha256, 'ZIP ordering does not affect integrity identity');
  assert.equal(hashDynamicTemplateManifest(manifest), hashDynamicTemplateManifest(Object.fromEntries(Object.entries(manifest).reverse())), 'JSON key order does not affect manifest identity');
  assert.notEqual(hashDynamicTemplateBundle(manifest, [files[0]!, file('assets/style.css', 'h1 { color: red }', 'text/css')]), snapshot.bundleSha256, 'changed asset bytes produce a new checksum');
  assert.throws(() => createDynamicTemplateVersionSnapshot({ manifest, files: [files[0]!], sourcePath: 'letters/v1/source', publishedAt: '2026-01-02T03:04:05Z' }), /manifest_asset_mismatch/);
});

test('Supabase database errors give actionable migration, schema, duplicate, and permission diagnostics', () => {
  assert.equal(classifyDynamicTemplateDatabaseError({ code: '42P01' }).code, 'dynamic_template_migration_required');
  assert.equal(classifyDynamicTemplateDatabaseError({ code: 'PGRST204' }).code, 'dynamic_template_migration_outdated');
  assert.equal(classifyDynamicTemplateDatabaseError({ code: '23505' }).code, 'duplicate_slug');
  const permissionFailure = classifyDynamicTemplateDatabaseError({ code: '42501' });
  assert.equal(permissionFailure.code, 'dynamic_template_database_permission');
  assert.match(permissionFailure.message, /20261111000200_dynamic_template_service_role_grants\.sql/);
});
