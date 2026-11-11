import 'server-only';

import type { Actor } from './services.ts';
import { createDynamicTemplateVersionSnapshot, validateDynamicTemplateManifest, type DynamicTemplateVersionSnapshot } from './dynamic-template-contract.ts';
import { analyzeTemplateFiles, MAX_FILES, MAX_FILE_BYTES, MAX_UNPACKED_BYTES, safeTemplatePath, templateContentTypeForPath, validateFiles, validateManifestForAnalysis, type DynamicManifest, type TemplateUploadFile } from './dynamic-template-validation.ts';
import { storageClient } from './dynamic-templates.ts';

const SNAPSHOT_COLUMNS = 'template_key,version,schema_version,entitlement_tier,manifest,entry_point,source_path,assets,bundle_sha256,published_at';

type SnapshotRow = {
  template_key: string;
  version: number;
  schema_version: number;
  entitlement_tier: string;
  manifest: unknown;
  entry_point: string;
  source_path: string;
  assets: unknown;
  bundle_sha256: string;
  published_at: string;
};

function normalizeSnapshotRow(row: SnapshotRow): DynamicTemplateVersionSnapshot {
  if (!Number.isInteger(row.version) || row.version < 1 || row.schema_version !== 1) throw new Error('dynamic_template_version_corrupt');
  if (row.entitlement_tier !== 'core' && row.entitlement_tier !== 'extended') throw new Error('dynamic_template_version_corrupt');
  if (typeof row.manifest !== 'object' || row.manifest === null || Array.isArray(row.manifest)) throw new Error('dynamic_template_version_corrupt');
  let manifest: DynamicManifest;
  try { manifest = validateDynamicTemplateManifest(row.manifest); } catch { throw new Error('dynamic_template_version_corrupt'); }
  if (manifest.schemaVersion !== row.schema_version || manifest.version !== row.version || manifest.id !== row.template_key || manifest.entryPoint !== row.entry_point || manifest.renderer !== 'custom-html') throw new Error('dynamic_template_version_corrupt');
  if (typeof row.source_path !== 'string' || !row.source_path || row.source_path.startsWith('/') || row.source_path.includes('..')) throw new Error('dynamic_template_version_corrupt');
  if (!Array.isArray(row.assets) || row.assets.some((item) => typeof item !== 'string')) throw new Error('dynamic_template_version_corrupt');
  if (row.assets.length !== manifest.assets.length || row.assets.some((asset, index) => asset !== manifest.assets[index])) throw new Error('dynamic_template_version_corrupt');
  if (!/^[a-f0-9]{64}$/.test(row.bundle_sha256)) throw new Error('dynamic_template_version_corrupt');
  if (!Number.isFinite(Date.parse(row.published_at))) throw new Error('dynamic_template_version_corrupt');
  return {
    templateId: row.template_key,
    version: row.version,
    schemaVersion: 1,
    entitlementTier: row.entitlement_tier,
    manifest: structuredClone(manifest),
    entryPoint: row.entry_point,
    sourcePath: row.source_path,
    assets: [...row.assets],
    bundleSha256: row.bundle_sha256,
    publishedAt: new Date(row.published_at).toISOString(),
  };
}

/** Server-only exact lookup. Never resolves "latest" and never reads draft metadata. */
export async function loadDynamicTemplateVersionForServer(templateKey: string, version: number): Promise<DynamicTemplateVersionSnapshot | null> {
  if (!/^dynamic-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateKey) || !Number.isInteger(version) || version < 1) return null;
  const { data, error } = await storageClient().from('dynamic_template_versions')
    .select(SNAPSHOT_COLUMNS).eq('template_key', templateKey).eq('version', version).maybeSingle();
  if (error) throw new Error(`dynamic_template_version_lookup_failed:${error.code ?? 'db_error'}`);
  return data ? normalizeSnapshotRow(data as SnapshotRow) : null;
}

export class DynamicTemplatePublishError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

function failStorage(code: string): never { throw new DynamicTemplatePublishError(code, 503); }
function storageSegment(name: string) {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) throw new DynamicTemplatePublishError('invalid_storage_path', 422);
  return name;
}

async function listSourceFiles(bucket: ReturnType<ReturnType<typeof storageClient>['storage']['from']>, sourcePath: string): Promise<string[]> {
  const found: string[] = [];
  const seen = new Set<string>();
  const folders = new Set<string>();
  async function visit(directory: string): Promise<void> {
    if (folders.has(directory) || folders.size >= MAX_FILES) throw new DynamicTemplatePublishError('storage_tree_invalid', 422);
    folders.add(directory);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await bucket.list(directory, { limit: 500, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data) failStorage('template_storage_unavailable');
      for (const item of data) {
        const name = storageSegment(item.name);
        const path = `${directory}/${name}`;
        if (!item.id) await visit(path);
        else {
          const relative = path.slice(sourcePath.length + 1);
          if (safeTemplatePath(relative) !== relative || seen.has(relative)) throw new DynamicTemplatePublishError('invalid_storage_path', 422);
          seen.add(relative);
          found.push(relative);
          if (found.length > MAX_FILES) throw new DynamicTemplatePublishError('too_many_files', 422);
        }
      }
      if (data.length < 500) break;
    }
  }
  await visit(sourcePath);
  return found.sort();
}

function publishDbError(error: { code?: string }) {
  const code = error.code ?? '';
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205') return new DynamicTemplatePublishError('dynamic_template_publish_migration_required', 503);
  if (code === '42501') return new DynamicTemplatePublishError('dynamic_template_publish_permission', 503);
  if (code === 'P0002') return new DynamicTemplatePublishError('template_not_found', 404);
  if (code === '55000' || code === '40001' || code === '23505') return new DynamicTemplatePublishError('template_publish_conflict', 409);
  if (code === '22023' || code === '23514') return new DynamicTemplatePublishError('template_snapshot_invalid', 422);
  return new DynamicTemplatePublishError('template_publish_failed', 500);
}

/**
 * Atomically publishes an admin-reviewed HTML template: re-read and validate the entire
 * private source bundle, build its immutable snapshot, then invoke the database RPC that
 * locks the parent and commits snapshot insertion + lifecycle update in one transaction.
 */
export async function publishDynamicTemplateForAdmin(input: { actor: Actor; templateRowId: string }): Promise<DynamicTemplateVersionSnapshot> {
  const { actor, templateRowId } = input;
  if (!actor.admin) throw new DynamicTemplatePublishError('admin_required', 403);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(templateRowId)) throw new DynamicTemplatePublishError('invalid_template_id', 400);
  let supabase: ReturnType<typeof storageClient>;
  try { supabase = storageClient(); } catch { throw new DynamicTemplatePublishError('server_not_configured', 503); }
  const { data: parent, error: parentError } = await supabase.from('dynamic_templates')
    .select('id,slug,status,version,renderer,manifest,entry_point,source_path,validation_errors')
    .eq('id', templateRowId).maybeSingle();
  if (parentError) throw publishDbError(parentError);
  if (!parent) throw new DynamicTemplatePublishError('template_not_found', 404);
  if (!['ready_for_preview', 'published'].includes(parent.status)) throw new DynamicTemplatePublishError('template_not_ready', 409);
  if (parent.renderer !== 'custom-html') throw new DynamicTemplatePublishError('unsupported_template_renderer', 409);
  if (!Array.isArray(parent.validation_errors) || parent.validation_errors.length) throw new DynamicTemplatePublishError('template_validation_failed', 409);
  if (!parent.source_path || typeof parent.manifest !== 'object' || parent.manifest === null || Array.isArray(parent.manifest)) throw new DynamicTemplatePublishError('template_metadata_invalid', 422);

  const manifestCandidate = parent.manifest as DynamicManifest;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parent.slug) || !Number.isInteger(parent.version) || parent.version < 1) throw new DynamicTemplatePublishError('template_metadata_invalid', 422);
  const versionPrefix = `${parent.slug}/v${parent.version}-`;
  const uploadSuffix = parent.source_path.startsWith(versionPrefix) ? parent.source_path.slice(versionPrefix.length) : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/source$/i.test(uploadSuffix)) throw new DynamicTemplatePublishError('template_source_path_invalid', 422);
  const expectedPrefix = parent.source_path;
  const bucket = supabase.storage.from('dynamic-templates');
  const storedPaths = await listSourceFiles(bucket, expectedPrefix);
  const allowedPaths = new Set([...manifestCandidate.assets, 'manifest.json', 'template.json']);
  if (storedPaths.some((path) => !allowedPaths.has(path)) || manifestCandidate.assets.some((path) => !storedPaths.includes(path)) || !storedPaths.includes(manifestCandidate.entryPoint)) {
    throw new DynamicTemplatePublishError('template_bundle_asset_mismatch', 422);
  }
  const files: TemplateUploadFile[] = [];
  let totalBytes = 0;
  for (const path of storedPaths) {
    const { data, error } = await bucket.download(`${expectedPrefix}/${path}`);
    if (error || !data) failStorage('template_storage_unavailable');
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) throw new DynamicTemplatePublishError('file_size_exceeded', 422);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_UNPACKED_BYTES) throw new DynamicTemplatePublishError('unpacked_size_exceeded', 422);
    files.push({ path, bytes, contentType: templateContentTypeForPath(path) });
  }
  try { validateFiles(files); } catch { throw new DynamicTemplatePublishError('template_bundle_invalid', 422); }
  const analysis = analyzeTemplateFiles(files);
  if (analysis.analysis.errors.length) throw new DynamicTemplatePublishError('template_validation_failed', 409);
  let manifest: DynamicManifest;
  try { manifest = validateManifestForAnalysis(manifestCandidate, analysis.analysis, files); }
  catch { throw new DynamicTemplatePublishError('template_manifest_invalid', 422); }
  if (manifest.slug !== parent.slug || manifest.version !== parent.version || manifest.renderer !== parent.renderer || manifest.entryPoint !== parent.entry_point) {
    throw new DynamicTemplatePublishError('template_metadata_mismatch', 409);
  }

  const snapshot = createDynamicTemplateVersionSnapshot({ manifest, files, sourcePath: expectedPrefix, publishedAt: new Date().toISOString() });
  const { data, error } = await supabase.rpc('publish_dynamic_template_version', {
    p_template_id: templateRowId,
    p_template_key: snapshot.templateId,
    p_version: snapshot.version,
    p_schema_version: snapshot.schemaVersion,
    p_expected_manifest: manifestCandidate,
    p_manifest: snapshot.manifest,
    p_entry_point: snapshot.entryPoint,
    p_source_path: snapshot.sourcePath,
    p_assets: snapshot.assets,
    p_bundle_sha256: snapshot.bundleSha256,
    p_actor: actor.uid,
  });
  if (error) throw publishDbError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.template_key !== snapshot.templateId || row.version !== snapshot.version || row.status !== 'published' || !Number.isFinite(Date.parse(row.published_at))) {
    throw new DynamicTemplatePublishError('template_publish_response_invalid', 500);
  }
  const published = { ...snapshot, publishedAt: new Date(row.published_at).toISOString() };
  await supabase.from('admin_audit_logs').insert({
    id: `template_publish_${templateRowId}_${snapshot.version}_${Date.now()}`,
    actor_uid: actor.uid,
    action: 'publish_template_snapshot',
    entity_type: 'dynamic_template',
    entity_id: templateRowId,
    details: { templateKey: snapshot.templateId, version: snapshot.version, bundleSha256: snapshot.bundleSha256 },
  });
  return published;
}
