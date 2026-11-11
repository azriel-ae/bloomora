import { unzipSync } from 'fflate';

export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 500;
export const DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION = 1 as const;
export const MAX_DYNAMIC_FIELD_LENGTH = 2000;
const forbidden = /(^|\/)(?:\.{1,2}|node_modules|\.git)(?:\/|$)|\.(?:exe|dll|so|dylib|bat|cmd|sh|ps1)$/i;
const allowed = /\.(?:html?|css|js|mjs|cjs|tsx?|jsx?|json|png|jpe?g|webp|gif|avif|svg|ico|woff2?|ttf|otf|mp3|m4a|wav|ogg|mp4|webm)$/i;
const htmlExtensions = /\.(?:html?|xhtml)$/i;

export type DynamicManifest = {
  schemaVersion: typeof DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION;
  id: string;
  name: { en: string; id: string };
  slug: string;
  version: number;
  description: { en: string; id: string };
  author: string;
  category: string;
  tags: string[];
  renderer: 'native' | 'custom-html' | 'custom-react';
  entryPoint: string;
  assets: string[];
  supportedFeatures: string[];
  supportedLocales: string[];
  configurationSchema: { fields: { key: string; label: string; type: 'text' | 'textarea'; maxLength: number; defaultValue: string; required: boolean }[] };
  requirements: string[];
  compatibility: { editorIntegration: boolean; customerReady: boolean; notes: string[] };
  rendererMetadata: { name: string; sandboxed: boolean; version: number };
  contract?: 'bloomora-template-v1';
};
export type TemplateUploadFile = { path: string; bytes: Uint8Array; contentType: string };
export type TemplateAnalysis = {
  format: 'html' | 'react' | 'unsupported';
  renderer: DynamicManifest['renderer'];
  entryPoint: string | null;
  language: 'id' | 'en' | 'unknown';
  files: { path: string; kind: string; size: number }[];
  dependencies: { local: string[]; external: string[]; missing: string[] };
  features: string[];
  editableFields: { key: string; label: string; type: 'text' | 'textarea' }[];
  errors: string[];
  warnings: string[];
};

const fileContentType = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript', json: 'application/json', tsx: 'application/typescript', ts: 'application/typescript', jsx: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream';
};
export const templateContentTypeForPath = fileContentType;

export function safeTemplatePath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.length > 240 || forbidden.test(normalized) || normalized.includes('..') || !allowed.test(normalized)) throw new Error(`unsupported_path:${path}`);
  return normalized;
}

export function validateFiles(files: TemplateUploadFile[]) {
  if (!files.length) throw new Error('no_files');
  if (files.length > MAX_FILES) throw new Error('too_many_files');
  let total = 0;
  const paths = new Set<string>();
  for (const file of files) {
    file.path = safeTemplatePath(file.path);
    if (paths.has(file.path)) throw new Error(`duplicate_path:${file.path}`);
    paths.add(file.path);
    if (file.bytes.byteLength > MAX_FILE_BYTES) throw new Error('file_size_exceeded');
    total += file.bytes.byteLength;
    if (total > MAX_UNPACKED_BYTES) throw new Error('unpacked_size_exceeded');
    const expected = fileContentType(file.path);
    if (file.contentType && file.contentType !== 'application/octet-stream' && file.contentType !== expected) throw new Error(`mime_mismatch:${file.path}`);
    file.contentType = expected;
  }
  return { files, totalBytes: total };
}

export function parseZip(bytes: Uint8Array): TemplateUploadFile[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('archive_size_exceeded');
  let entries = 0;
  let declaredBytes = 0;
  const archive = unzipSync(bytes, {
    filter: (file) => {
      entries += 1;
      if (entries > MAX_FILES) throw new Error('too_many_files');
      if (file.originalSize > MAX_FILE_BYTES) throw new Error('file_size_exceeded');
      declaredBytes += file.originalSize;
      if (declaredBytes > MAX_UNPACKED_BYTES) throw new Error('unpacked_size_exceeded');
      return true;
    },
  });
  return validateFiles(Object.entries(archive).map(([path, value]) => ({ path: safeTemplatePath(path), bytes: value, contentType: fileContentType(path) }))).files;
}

function normalizeSlug(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'new-template';
}
function titleFromPath(path: string) {
  const base = path.split('/').pop()?.replace(/\.(?:html?|zip)$/i, '') ?? 'New Template';
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 120) || 'New Template';
}
function htmlText(html: string) { return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ').replace(/\s+/g, ' ').trim(); }
function detectLanguage(text: string, html: string): TemplateAnalysis['language'] {
  const explicit = html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-z-]+)/i)?.[1]?.toLowerCase();
  if (explicit?.startsWith('id')) return 'id';
  if (explicit?.startsWith('en')) return 'en';
  const lower = ` ${text.toLowerCase()} `;
  const idWords = [' yang ', ' untuk ', ' dengan ', ' kamu ', ' cinta ', ' selamat ', ' semoga ', ' terima kasih '].filter((word) => lower.includes(word)).length;
  const enWords = [' the ', ' you ', ' with ', ' love ', ' happy ', ' thank you ', ' dear '].filter((word) => lower.includes(word)).length;
  return idWords === enWords ? 'unknown' : idWords > enWords ? 'id' : 'en';
}
function resourceReferences(path: string, text: string) {
  const refs = new Set<string>();
  const html = htmlExtensions.test(path);
  if (html) {
    for (const match of text.matchAll(/<(?:img|script|source|video|audio|iframe|track|embed|input)\b[^>]*?\b(?:src|poster)\s*=\s*(["'])(.*?)\1/gi)) refs.add(match[2]);
    for (const match of text.matchAll(/<link\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
      if (/rel\s*=\s*["']?(?:stylesheet|preload|icon|manifest)/i.test(match[0])) refs.add(match[2]);
    }
    for (const match of text.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) for (const candidate of match[2].split(',')) refs.add(candidate.trim().split(/\s+/)[0]);
  }
  if (/\.css$/i.test(path)) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+(?:url\()?["']([^"')]+)["']/gi)) refs.add(match[1] ?? match[2]);
  }
  if (/\.(?:js|mjs|cjs)$/i.test(path)) {
    for (const match of text.matchAll(/\b(?:import\s*(?:\(\s*)?|(?:import|export)\b[^;\n]*?\bfrom\s*)(["'])([^"']+)\1/g)) {
      const specifier = match[2];
      refs.add(/^(?:\.{1,2}\/|\/|https?:|\/\/)/i.test(specifier) ? specifier : `module:${specifier}`);
    }
  }
  return [...refs].filter(Boolean);
}
function resolveLocal(basePath: string, ref: string) {
  const value = ref.trim().split(/[?#]/, 1)[0];
  if (!value || /^(?:#|data:|blob:|javascript:|mailto:|tel:)/i.test(value)) return null;
  if (/^(?:https?:)?\/\//i.test(value)) return { external: value } as const;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return { invalid: value } as const; }
  const segments = (decoded.startsWith('/') ? decoded.slice(1) : `${basePath.split('/').slice(0, -1).join('/')}/${decoded}`).split('/');
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!normalized.length) return { invalid: value } as const; normalized.pop(); }
    else normalized.push(segment);
  }
  return { local: normalized.join('/') } as const;
}
function readText(file: TemplateUploadFile) { return new TextDecoder('utf-8', { fatal: false }).decode(file.bytes); }

function detectEditableFields(html: string) {
  const fields: TemplateAnalysis['editableFields'] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*?)\bdata-bloomora-field\s*=\s*(["'])([a-zA-Z][\w.-]{0,63})\3([^>]*)>/gi)) {
    const key = match[4];
    if (seen.has(key)) continue;
    seen.add(key);
    const attrs = `${match[2]} ${match[5]}`;
    const label = attrs.match(/\b(?:aria-label|data-bloomora-label|placeholder)\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim() || key.replace(/[._-]+/g, ' ');
    fields.push({ key, label: label.slice(0, 100), type: /textarea/i.test(match[1]) ? 'textarea' : 'text' });
  }
  return fields;
}

export function analyzeTemplateFiles(inputFiles: TemplateUploadFile[]): { analysis: TemplateAnalysis; manifest: DynamicManifest } {
  const files = validateFiles(inputFiles).files;
  const htmlFiles = files.filter((file) => htmlExtensions.test(file.path));
  const sourceFiles = files.filter((file) => /\.(?:tsx?|jsx?)$/i.test(file.path));
  const hasPackageJson = files.some((file) => /(^|\/)package\.json$/i.test(file.path));
  const entryFile = htmlFiles.slice().sort((a, b) => {
    const score = (file: TemplateUploadFile) => (/^(?:index|main)\.html?$/i.test(file.path) ? 0 : /(?:^|\/)(?:index|main)\.html?$/i.test(file.path) ? 1 : 2) * 1000 + file.path.length;
    return score(a) - score(b);
  })[0] ?? null;
  const unsupportedReact = sourceFiles.some((file) => /\.(?:tsx|jsx)$/i.test(file.path)) || (!htmlFiles.length && hasPackageJson);
  const format: TemplateAnalysis['format'] = entryFile && !unsupportedReact ? 'html' : unsupportedReact ? 'react' : 'unsupported';
  const renderer: DynamicManifest['renderer'] = format === 'html' ? 'custom-html' : format === 'react' ? 'custom-react' : 'native';
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!entryFile && format !== 'react') errors.push('html_entry_point_missing');
  if (format === 'react') errors.push('react_build_worker_unavailable');
  if (format === 'unsupported') errors.push('unsupported_template_format');

  const fileMap = new Map(files.map((file) => [file.path, file]));
  const local = new Set<string>();
  const external = new Set<string>();
  const missing = new Set<string>();
  const features = new Set<string>();
  let combinedHtml = '';
  let visibleText = '';
  for (const file of files) {
    const text = /\.(?:html?|css|js|mjs|cjs|tsx?|jsx?)$/i.test(file.path) ? readText(file) : '';
    if (htmlExtensions.test(file.path)) { combinedHtml += `\n${text}`; visibleText += ` ${htmlText(text)}`; }
    if (htmlExtensions.test(file.path) && /<script\b/i.test(text)) features.add('javascript');
    if (htmlExtensions.test(file.path) && /<style\b/i.test(text)) features.add('inline-css');
    if (/\.css$/i.test(file.path)) features.add('stylesheet');
    if (/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(file.path)) features.add('images');
    if (/\.(?:mp3|m4a|wav|ogg)$/i.test(file.path)) features.add('audio-assets');
    if (/\.(?:mp4|webm)$/i.test(file.path)) features.add('video-assets');
    if (/(?:<button\b|<form\b|\bon(?:click|input|change)\s*=|addEventListener\s*\()/i.test(text)) features.add('interactive-elements');
    for (const ref of resourceReferences(file.path, text)) {
      if (ref.startsWith('module:')) { external.add(`npm:${ref.slice('module:'.length)}`); continue; }
      const resolved = resolveLocal(file.path, ref);
      if (!resolved) continue;
      if ('external' in resolved && resolved.external) { external.add(resolved.external); continue; }
      if ('invalid' in resolved) { missing.add(`${file.path} -> ${ref} (invalid path)`); continue; }
      if (resolved.local && resolved.local !== file.path) {
        local.add(resolved.local);
        if (!fileMap.has(resolved.local)) missing.add(`${file.path} -> ${resolved.local}`);
      }
    }
  }
  const editableFields = detectEditableFields(combinedHtml);
  if ([...external].some((dependency) => dependency.startsWith('npm:'))) errors.push('unbundled_package_dependencies');
  if (editableFields.length) features.add('explicit-editor-fields');
  if (external.size) warnings.push('external_resources_unverified');
  if (missing.size) warnings.push('local_assets_missing');
  if (!editableFields.length) warnings.push('editor_fields_not_detected');
  if (entryFile && !/\bviewport\b/i.test(readText(entryFile))) warnings.push('mobile_viewport_not_detected');
  if (entryFile && !/@media\b/i.test(combinedHtml)) warnings.push('responsive_rules_not_detected');
  warnings.push('customer_renderer_not_integrated');

  const htmlTitle = entryFile ? readText(entryFile).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() : '';
  const headingTitle = entryFile ? readText(entryFile).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() : '';
  const title = htmlTitle || headingTitle || titleFromPath(entryFile?.path ?? files[0]?.path ?? 'new-template');
  const description = entryFile ? (readText(entryFile).match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() || '') : '';
  const language = entryFile ? detectLanguage(visibleText, readText(entryFile)) : 'unknown';
  const name = title.slice(0, 120) || 'New Template';
  const slug = normalizeSlug(name);
  const assetPaths = files.map((file) => file.path).filter((path) => path !== 'manifest.json' && path !== 'template.json');
  const manifest: DynamicManifest = {
    schemaVersion: DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION,
    id: `dynamic-${slug}`,
    name: { en: name, id: name },
    slug,
    version: 1,
    description: { en: description, id: description },
    author: '',
    category: 'uncategorized',
    tags: [],
    renderer,
    entryPoint: entryFile?.path ?? '',
    assets: assetPaths,
    supportedFeatures: [...features].sort(),
    supportedLocales: language === 'unknown' ? [] : [language],
    configurationSchema: { fields: editableFields.map((field) => ({ ...field, maxLength: field.type === 'textarea' ? MAX_DYNAMIC_FIELD_LENGTH : 200, defaultValue: '', required: false })) },
    requirements: [...external].sort(),
    compatibility: { editorIntegration: false, customerReady: false, notes: ['Belum terhubung ke renderer/editor customer Bloomora.'] },
    rendererMetadata: { name: format === 'html' ? 'isolated-html-preview' : renderer, sandboxed: format === 'html', version: 1 },
  };
  const analysis: TemplateAnalysis = {
    format,
    renderer,
    entryPoint: entryFile?.path ?? null,
    language,
    files: files.map((file) => ({ path: file.path, kind: fileContentType(file.path), size: file.bytes.byteLength })),
    dependencies: { local: [...local].sort(), external: [...external].sort(), missing: [...missing].sort() },
    features: [...features].sort(),
    editableFields,
    errors,
    warnings,
  };
  return { analysis, manifest };
}

export function validateManifestForAnalysis(value: unknown, analysis: TemplateAnalysis, files: TemplateUploadFile[]): DynamicManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('manifest_invalid');
  const candidate = value as Partial<DynamicManifest>;
  const schemaVersion = candidate.schemaVersion ?? DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION;
  if (schemaVersion !== DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported_manifest_schema_version');
  if (!candidate.name || typeof candidate.name.en !== 'string' || typeof candidate.name.id !== 'string') throw new Error('manifest_invalid_name');
  if (candidate.name.en.length < 1 || candidate.name.en.length > 120 || candidate.name.id.length < 1 || candidate.name.id.length > 120) throw new Error('manifest_invalid_name');
  if (typeof candidate.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug) || candidate.slug.length > 80) throw new Error('invalid_slug');
  if (!['native', 'custom-html', 'custom-react'].includes(candidate.renderer ?? '')) throw new Error('manifest_invalid_renderer');
  if (candidate.renderer !== analysis.renderer) throw new Error('renderer_detection_mismatch');
  if (typeof candidate.category !== 'string' || !candidate.category.trim() || candidate.category.length > 80) throw new Error('manifest_invalid_category');
  if (typeof candidate.entryPoint !== 'string' || candidate.entryPoint !== analysis.entryPoint || !files.some((file) => file.path === candidate.entryPoint)) throw new Error('entry_point_invalid');
  const detectedFeatures = new Set(analysis.features);
  const supportedFeatures = Array.isArray(candidate.supportedFeatures) ? candidate.supportedFeatures : [];
  if (supportedFeatures.some((feature) => typeof feature !== 'string' || !detectedFeatures.has(feature))) throw new Error('unsupported_feature_claim');
  const detectedLocales: string[] = analysis.language === 'unknown' ? [] : [analysis.language];
  const requestedLocales = Array.isArray(candidate.supportedLocales) ? candidate.supportedLocales : [];
  if (requestedLocales.some((locale) => typeof locale !== 'string' || !detectedLocales.includes(locale))) throw new Error('unsupported_locale_claim');
  const detectedFields = new Set(analysis.editableFields.map((field) => field.key));
  const detectedFieldByKey = new Map(analysis.editableFields.map((field) => [field.key, field]));
  if (candidate.configurationSchema !== undefined && (!candidate.configurationSchema || typeof candidate.configurationSchema !== 'object' || Array.isArray(candidate.configurationSchema) || !Array.isArray(candidate.configurationSchema.fields))) throw new Error('unsupported_editor_field_claim');
  const fields = candidate.configurationSchema?.fields ?? [];
  const suppliedFieldKeys = new Set<string>();
  if (!Array.isArray(fields) || fields.length > 100 || fields.length > detectedFields.size || fields.some((field) => {
    if (!field || typeof field.key !== 'string' || !detectedFields.has(field.key)) return true;
    if (suppliedFieldKeys.has(field.key)) return true;
    suppliedFieldKeys.add(field.key);
    if (field.type !== undefined && field.type !== detectedFieldByKey.get(field.key)?.type) return true;
    if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > MAX_DYNAMIC_FIELD_LENGTH)) return true;
    if (field.required !== undefined && typeof field.required !== 'boolean') return true;
    return field.defaultValue !== undefined && (typeof field.defaultValue !== 'string' || field.defaultValue.length > (field.maxLength ?? (field.type === 'textarea' ? MAX_DYNAMIC_FIELD_LENGTH : 200)));
  })) throw new Error('unsupported_editor_field_claim');
  const version = candidate.version ?? 1;
  if (!Number.isInteger(version) || version !== 1) throw new Error('invalid_version');
  const base = analyzeTemplateFiles(files).manifest;
  const name = { en: candidate.name.en.trim(), id: candidate.name.id.trim() };
  const description = candidate.description && typeof candidate.description.en === 'string' && typeof candidate.description.id === 'string' ? { en: candidate.description.en.slice(0, 2000), id: candidate.description.id.slice(0, 2000) } : base.description;
  const filteredLocales = requestedLocales.filter((locale): locale is string => typeof locale === 'string' && detectedLocales.includes(locale));
  const fieldsByKey = detectedFieldByKey;
  return {
    ...base,
    schemaVersion: DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION,
    id: `dynamic-${candidate.slug}`,
    name,
    slug: candidate.slug,
    version,
    description,
    author: typeof candidate.author === 'string' ? candidate.author.slice(0, 120) : '',
    category: candidate.category.trim(),
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20).map((tag) => tag.slice(0, 40)) : [],
    renderer: candidate.renderer as DynamicManifest['renderer'],
    entryPoint: candidate.entryPoint,
    assets: base.assets,
    supportedFeatures: supportedFeatures as string[],
    supportedLocales: filteredLocales,
    configurationSchema: { fields: fields.map((field) => {
      const detected = fieldsByKey.get(field.key)!;
      const maxLength = field.maxLength ?? (detected.type === 'textarea' ? MAX_DYNAMIC_FIELD_LENGTH : 200);
      return { ...detected, maxLength, defaultValue: typeof field.defaultValue === 'string' ? field.defaultValue : '', required: field.required === true };
    }) },
    requirements: base.requirements,
    compatibility: base.compatibility,
    rendererMetadata: base.rendererMetadata,
  };
}

/** Backward-compatible parser for previously supplied manifests. */
export function parseManifest(files: TemplateUploadFile[]): DynamicManifest {
  const manifestFile = files.find((file) => file.path === 'manifest.json' || file.path === 'template.json');
  if (!manifestFile) throw new Error('manifest_missing');
  let raw: unknown;
  try { raw = JSON.parse(readText(manifestFile)); } catch { throw new Error('manifest_invalid_json'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('manifest_invalid');
  const candidate = raw as Partial<DynamicManifest> & { name?: unknown; category?: unknown; renderer?: unknown; entryPoint?: unknown };
  if (candidate.schemaVersion !== undefined && candidate.schemaVersion !== DYNAMIC_TEMPLATE_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported_manifest_schema_version');
  const entryPoint = typeof candidate.entryPoint === 'string' ? safeTemplatePath(candidate.entryPoint) : '';
  if (!entryPoint || !files.some((file) => file.path === entryPoint)) throw new Error('entry_point_missing');
  if (!candidate.name || typeof candidate.name !== 'object' || typeof (candidate.name as { en?: unknown }).en !== 'string' || typeof (candidate.name as { id?: unknown }).id !== 'string') throw new Error('manifest_invalid_name');
  if (typeof candidate.category !== 'string' || !['native', 'custom-html', 'custom-react'].includes(String(candidate.renderer))) throw new Error('manifest_invalid');
  if ((candidate.renderer === 'custom-react' || candidate.renderer === 'native') && candidate.contract !== 'bloomora-template-v1') throw new Error('native_contract_missing');
  const title = (candidate.name as { en: string; id: string });
  const slug = typeof candidate.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug) ? candidate.slug : normalizeSlug(title.en);
  const detected = analyzeTemplateFiles(files);
  const description = candidate.description && typeof candidate.description.en === 'string' && typeof candidate.description.id === 'string'
    ? candidate.description : detected.manifest.description;
  const normalized = {
    ...detected.manifest,
    id: `dynamic-${slug}`,
    name: { en: title.en, id: title.id },
    slug,
    version: candidate.version ?? 1,
    description,
    author: typeof candidate.author === 'string' ? candidate.author.slice(0, 120) : '',
    category: candidate.category,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    renderer: candidate.renderer,
    entryPoint,
    supportedFeatures: Array.isArray(candidate.supportedFeatures) ? candidate.supportedFeatures : [],
    supportedLocales: Array.isArray(candidate.supportedLocales) ? candidate.supportedLocales : [],
    configurationSchema: candidate.configurationSchema ?? detected.manifest.configurationSchema,
  };
  return validateManifestForAnalysis(normalized, detected.analysis, files);
}
