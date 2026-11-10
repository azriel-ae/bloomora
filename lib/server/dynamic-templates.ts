import 'server-only';

import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 500;
const forbidden = /(^|\/)(?:\.\.?|node_modules|\.git)(?:\/|$)|\.(?:exe|dll|so|dylib|bat|cmd|sh|ps1)$/i;
const allowed = /\.(?:html?|css|js|mjs|cjs|tsx?|json|png|jpe?g|webp|svg|woff2?|ttf|otf)$/i;

const l10n = z.object({ en: z.string().min(1).max(500), id: z.string().min(1).max(500) });
export const manifestSchema = z.object({
  name: l10n, tagline: l10n.optional(), description: l10n.optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  category: z.string().min(1).max(80), renderer: z.enum(['native', 'custom-html', 'custom-react']),
  entryPoint: z.string().min(1).max(240), version: z.number().int().positive().optional(),
  contract: z.literal('bloomora-template-v1').optional(),
}).strict();
export type DynamicManifest = z.infer<typeof manifestSchema>;
export type TemplateUploadFile = { path: string; bytes: Uint8Array; contentType: string };

function safePath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.length > 240 || forbidden.test(normalized) || normalized.includes('..') || !allowed.test(normalized)) throw new Error(`unsupported_path:${path}`);
  return normalized;
}
function contentType(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', tsx: 'application/typescript', ts: 'application/typescript', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream';
}
export function validateFiles(files: TemplateUploadFile[]) {
  if (!files.length) throw new Error('no_files');
  if (files.length > MAX_FILES) throw new Error('too_many_files');
  let total = 0;
  for (const file of files) { safePath(file.path); total += file.bytes.byteLength; if (total > MAX_UNPACKED_BYTES) throw new Error('unpacked_size_exceeded'); }
  return { files, totalBytes: total };
}
export function parseZip(bytes: Uint8Array): TemplateUploadFile[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('archive_size_exceeded');
  const archive = unzipSync(bytes, { filter: (file) => file.originalSize <= MAX_UNPACKED_BYTES });
  const files = Object.entries(archive).map(([path, value]) => ({ path: safePath(path), bytes: value, contentType: contentType(path) }));
  return validateFiles(files).files;
}
export function parseManifest(files: TemplateUploadFile[]): DynamicManifest {
  const manifestFile = files.find((file) => file.path === 'manifest.json' || file.path === 'template.json');
  if (!manifestFile) throw new Error('manifest_missing');
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(manifestFile.bytes)); } catch { throw new Error('manifest_invalid_json'); }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`manifest_invalid:${parsed.error.issues.map((issue) => issue.path.join('.') + ' ' + issue.message).join('; ')}`);
  const entry = safePath(parsed.data.entryPoint);
  if (!files.some((file) => file.path === entry)) throw new Error('entry_point_missing');
  if (parsed.data.renderer === 'custom-react' && !parsed.data.contract) throw new Error('react_contract_missing');
  if (parsed.data.renderer === 'native' && !parsed.data.contract) throw new Error('native_contract_missing');
  return { ...parsed.data, entryPoint: entry };
}
export function uploadId(slug: string, version: number) { return `${slug}/v${version}-${createHash('sha256').update(`${slug}:${version}:${Date.now()}`).digest('hex').slice(0, 12)}`; }
export function storageClient() { const client = createSupabaseAdminClient(); if (!client) throw new Error('server_not_configured'); return client; }
