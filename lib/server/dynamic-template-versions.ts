import 'server-only';

import type { Actor } from './services.ts';
import { hashDynamicTemplateManifest, validateDynamicTemplateManifest, type DynamicTemplateVersionSnapshot } from './dynamic-template-contract.ts';
import type { DynamicManifest } from './dynamic-template-validation.ts';
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

/**
 * Append a reviewed immutable snapshot. The caller must be an authenticated admin and must
 * validate/upload the source bundle before calling; database constraints prevent updates.
 * This primitive intentionally does not activate the existing customer Publish endpoint.
 */
export async function appendDynamicTemplateVersion(input: {
  actor: Actor;
  templateRowId: string;
  snapshot: DynamicTemplateVersionSnapshot;
}): Promise<void> {
  const { actor, templateRowId, snapshot } = input;
  if (!actor.admin) throw new Error('admin_required');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(templateRowId)) throw new Error('invalid_template_row_id');
  const manifest = validateDynamicTemplateManifest(snapshot.manifest);
  if (snapshot.templateId !== manifest.id || snapshot.version !== manifest.version || snapshot.schemaVersion !== 1 || snapshot.entryPoint !== manifest.entryPoint) throw new Error('dynamic_template_version_corrupt');
  if (snapshot.sourcePath.startsWith('/') || snapshot.sourcePath.includes('..') || !/^[a-f0-9]{64}$/.test(snapshot.bundleSha256)) throw new Error('dynamic_template_version_corrupt');
  if (!Array.isArray(snapshot.assets) || snapshot.assets.length !== manifest.assets.length || snapshot.assets.some((path, index) => path !== manifest.assets[index])) throw new Error('dynamic_template_version_corrupt');
  if (!Number.isFinite(Date.parse(snapshot.publishedAt))) throw new Error('dynamic_template_version_corrupt');
  if (snapshot.entitlementTier !== 'core') throw new Error('unsupported_dynamic_template_tier');
  const supabase = storageClient();
  const { data: draft, error: lookupError } = await supabase.from('dynamic_templates')
    .select('slug,status,version,renderer,source_path,manifest').eq('id', templateRowId).maybeSingle();
  if (lookupError) throw new Error(`dynamic_template_version_parent_lookup_failed:${lookupError.code ?? 'db_error'}`);
  let parentManifestHash = '';
  try { parentManifestHash = draft ? hashDynamicTemplateManifest(draft.manifest) : ''; } catch { /* fail closed below */ }
  if (!draft || draft.status !== 'ready_for_preview' || draft.slug !== manifest.slug || draft.version !== snapshot.version || draft.renderer !== manifest.renderer || draft.source_path !== snapshot.sourcePath || parentManifestHash !== hashDynamicTemplateManifest(manifest)) {
    throw new Error('dynamic_template_version_parent_mismatch');
  }
  const { error } = await supabase.from('dynamic_template_versions').insert({
    template_id: templateRowId,
    template_key: snapshot.templateId,
    version: snapshot.version,
    schema_version: snapshot.schemaVersion,
    entitlement_tier: snapshot.entitlementTier,
    manifest,
    renderer: manifest.renderer,
    entry_point: snapshot.entryPoint,
    source_path: snapshot.sourcePath,
    assets: snapshot.assets,
    bundle_sha256: snapshot.bundleSha256,
    published_at: snapshot.publishedAt,
    created_by: actor.uid,
  });
  if (error) throw new Error(`dynamic_template_version_insert_failed:${error.code ?? 'db_error'}`);
}
