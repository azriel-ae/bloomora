import 'server-only';

import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '../supabase/admin.ts';
export { parseManifest, parseZip, validateFiles, MAX_ARCHIVE_BYTES, MAX_UNPACKED_BYTES, MAX_FILES } from './dynamic-template-validation.ts';
export type { DynamicManifest, TemplateUploadFile } from './dynamic-template-validation.ts';

export function uploadId(slug: string, version: number) { return `${slug}/v${version}-${createHash('sha256').update(`${slug}:${version}:${Date.now()}`).digest('hex').slice(0, 12)}`; }
export function storageClient() { const client = createSupabaseAdminClient(); if (!client) throw new Error('server_not_configured'); return client; }
