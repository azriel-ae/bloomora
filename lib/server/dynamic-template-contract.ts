import { createHash } from 'node:crypto';
import type { DynamicManifest, TemplateUploadFile } from './dynamic-template-validation.ts';
import { DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION, MAX_DYNAMIC_FIELD_LENGTH, safeTemplatePath } from './dynamic-template-validation.ts';
import type { TemplateInfo } from './services.ts';

export type DynamicTemplateValues = Record<string, string>;
export type DynamicTemplateVersionSnapshot = {
  templateId: string;
  version: number;
  schemaVersion: typeof DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION;
  entitlementTier: 'core' | 'extended';
  manifest: DynamicManifest;
  entryPoint: string;
  sourcePath: string;
  assets: string[];
  bundleSha256: string;
  publishedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateDynamicTemplateManifest(value: unknown): DynamicManifest {
  if (!isRecord(value) || value.schemaVersion !== DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported_manifest_schema_version');
  if (typeof value.id !== 'string' || !/^dynamic-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) throw new Error('dynamic_manifest_invalid');
  if (typeof value.slug !== 'string' || value.id !== `dynamic-${value.slug}` || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) throw new Error('dynamic_manifest_invalid');
  if (!Number.isInteger(value.version) || (value.version as number) < 1 || value.renderer !== 'custom-html') throw new Error('dynamic_manifest_invalid');
  if (typeof value.entryPoint !== 'string' || !value.entryPoint || value.entryPoint.startsWith('/') || value.entryPoint.includes('..')) throw new Error('dynamic_manifest_invalid');
  if (!isRecord(value.name) || typeof value.name.en !== 'string' || typeof value.name.id !== 'string') throw new Error('dynamic_manifest_invalid');
  if ([value.name.en, value.name.id].some((name) => name.length < 1 || name.length > 120)) throw new Error('dynamic_manifest_invalid');
  if (!Array.isArray(value.assets) || value.assets.some((asset) => typeof asset !== 'string') || new Set(value.assets).size !== value.assets.length) throw new Error('dynamic_manifest_invalid');
  try {
    safeTemplatePath(value.entryPoint);
    for (const asset of value.assets) safeTemplatePath(asset as string);
  } catch { throw new Error('dynamic_manifest_invalid'); }
  const manifest = value as unknown as DynamicManifest;
  validateDynamicTemplateValues(manifest, {});
  return structuredClone(manifest);
}

/**
 * Validate and normalize customer-editable values using only the server-validated manifest.
 * No markup, source, renderer settings, or undeclared keys are accepted here.
 */
export function validateDynamicTemplateValues(manifest: DynamicManifest, input: unknown): DynamicTemplateValues {
  if (manifest.schemaVersion !== DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported_manifest_schema_version');
  if (!isRecord(input)) throw new Error('dynamic_values_invalid');
  const fields = manifest.configurationSchema?.fields;
  if (!Array.isArray(fields) || fields.length > 100) throw new Error('dynamic_manifest_fields_invalid');
  const allowed = new Map<string, { maxLength: number; defaultValue: string; required: boolean }>();
  for (const field of fields) {
    if (!field || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(field.key)) throw new Error('dynamic_manifest_fields_invalid');
    if (typeof field.label !== 'string' || field.label.length < 1 || field.label.length > 100) throw new Error('dynamic_manifest_fields_invalid');
    if (field.type !== 'text' && field.type !== 'textarea') throw new Error('dynamic_manifest_fields_invalid');
    const maxLength = field.maxLength ?? (field.type === 'textarea' ? MAX_DYNAMIC_FIELD_LENGTH : 200);
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > MAX_DYNAMIC_FIELD_LENGTH) throw new Error('dynamic_manifest_fields_invalid');
    const defaultValue = field.defaultValue ?? '';
    if (typeof defaultValue !== 'string' || defaultValue.length > maxLength) throw new Error('dynamic_manifest_fields_invalid');
    if (typeof field.required !== 'boolean') throw new Error('dynamic_manifest_fields_invalid');
    if (allowed.has(field.key)) throw new Error('dynamic_manifest_fields_invalid');
    allowed.set(field.key, { maxLength, defaultValue, required: field.required });
  }
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error('dynamic_field_not_allowed');
  const normalized: DynamicTemplateValues = {};
  for (const [key, definition] of allowed) {
    const value = Object.hasOwn(input, key) ? input[key] : definition.defaultValue;
    if (typeof value !== 'string') throw new Error('dynamic_field_type_invalid');
    if (value.length > definition.maxLength) throw new Error('dynamic_field_too_long');
    normalized[key] = value;
  }
  return normalized;
}

/** Publish completeness is separate so incomplete drafts remain valid and editable. */
export function missingRequiredDynamicTemplateFields(manifest: DynamicManifest, input: unknown): string[] {
  const normalized = validateDynamicTemplateValues(manifest, input);
  return manifest.configurationSchema.fields.filter((field) => field.required && !normalized[field.key]?.trim()).map((field) => field.key);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashDynamicTemplateManifest(value: unknown): string {
  const manifest = validateDynamicTemplateManifest(value);
  return createHash('sha256').update(stableJson(manifest)).digest('hex');
}

/** Hashes the validated manifest and uploaded assets in path order, independent of ZIP order. */
export function hashDynamicTemplateBundle(manifest: DynamicManifest, files: readonly TemplateUploadFile[]): string {
  if (manifest.schemaVersion !== DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported_manifest_schema_version');
  if (!Number.isInteger(manifest.version) || manifest.version < 1) throw new Error('invalid_version');
  const paths = new Set<string>();
  const sorted = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const hash = createHash('sha256');
  hash.update(stableJson(manifest));
  hash.update('\0');
  for (const file of sorted) {
    if (safeTemplatePath(file.path) !== file.path) throw new Error('invalid_template_bundle_path');
    if (!file.path || paths.has(file.path)) throw new Error('duplicate_path');
    paths.add(file.path);
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.contentType);
    hash.update('\0');
    hash.update(String(file.bytes.byteLength));
    hash.update('\0');
    hash.update(file.bytes);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** Build the exact immutable metadata row that a future publish transaction must insert. */
export function createDynamicTemplateVersionSnapshot(input: {
  manifest: DynamicManifest;
  files: readonly TemplateUploadFile[];
  sourcePath: string;
  publishedAt: string;
}): DynamicTemplateVersionSnapshot {
  const { files, sourcePath, publishedAt } = input;
  const manifest = validateDynamicTemplateManifest(input.manifest);
  if (!/^dynamic-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id !== `dynamic-${manifest.slug}`) throw new Error('invalid_template_id');
  if (!sourcePath || sourcePath.startsWith('/') || sourcePath.includes('..')) throw new Error('invalid_source_path');
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error('invalid_published_at');
  const paths = new Set(files.map((file) => {
    if (safeTemplatePath(file.path) !== file.path) throw new Error('invalid_template_bundle_path');
    return file.path;
  }));
  if (!paths.has(manifest.entryPoint)) throw new Error('entry_point_missing');
  const assets = [...new Set(manifest.assets)];
  if (assets.length !== manifest.assets.length || assets.some((asset) => !paths.has(asset))) throw new Error('manifest_asset_mismatch');
  const expectedAssets = [...paths].filter((path) => path !== 'manifest.json' && path !== 'template.json').sort();
  if ([...assets].sort().join('\0') !== expectedAssets.join('\0')) throw new Error('manifest_asset_mismatch');
  return {
    templateId: manifest.id,
    version: manifest.version,
    schemaVersion: manifest.schemaVersion,
    entitlementTier: 'core',
    manifest: structuredClone(manifest),
    entryPoint: manifest.entryPoint,
    sourcePath,
    assets,
    bundleSha256: hashDynamicTemplateBundle(manifest, files),
    publishedAt: new Date(publishedAt).toISOString(),
  };
}

/** Adapt one pinned immutable version to the validation contract used by gift services. */
export function dynamicVersionToTemplateInfo(snapshot: DynamicTemplateVersionSnapshot): TemplateInfo {
  const manifest = validateDynamicTemplateManifest(snapshot.manifest);
  if (manifest.id !== snapshot.templateId || manifest.version !== snapshot.version) throw new Error('dynamic_template_version_corrupt');
  const validateFields = (content: Parameters<NonNullable<TemplateInfo['validateContent']>>[0]) => {
    if (content.sections.length || Object.keys(content.data).length || content.media.length) throw new Error('dynamic_content_shape_unsupported');
    return validateDynamicTemplateValues(manifest, content.fields);
  };
  return {
    id: snapshot.templateId,
    version: snapshot.version,
    tier: snapshot.entitlementTier,
    validateContent(content) {
      try { validateFields(content); return null; }
      catch (error) { return error instanceof Error ? error.message : 'dynamic_content_invalid'; }
    },
    missingForPublish(content) {
      try { return missingRequiredDynamicTemplateFields(manifest, validateFields(content)); }
      catch (error) { return [error instanceof Error ? error.message : 'dynamic_content_invalid']; }
    },
  };
}
