import 'server-only';

import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '../supabase/admin.ts';
export { analyzeTemplateFiles, parseManifest, parseZip, safeTemplatePath, validateFiles, validateManifestForAnalysis, MAX_ARCHIVE_BYTES, MAX_UNPACKED_BYTES, MAX_FILES } from './dynamic-template-validation.ts';
export type { DynamicManifest, TemplateAnalysis, TemplateUploadFile } from './dynamic-template-validation.ts';

export function uploadId(slug: string, version: number) { return `${slug}/v${version}-${randomUUID()}`; }
export function storageClient() { const client = createSupabaseAdminClient(); if (!client) throw new Error('server_not_configured'); return client; }
