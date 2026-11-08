import 'server-only';

import type { Sql, TransactionSql } from 'postgres';
import type { Doc, Store, Tx } from './store.ts';

const RETRY_LIMIT = 3;

type WriteKind = 'create' | 'set' | 'update' | 'delete';
type PathInfo = {
  collection: string;
  table: string;
  keys: Record<string, string>;
  keyColumns: string[];
  keyValues: unknown[];
  documentId: string;
};
type PendingWrite = { kind: WriteKind; path: string; data: Doc };
type Row = Record<string, unknown>;

const COLLECTIONS: Record<string, { table: string; keyColumn: string; fields: Record<string, string> }> = {
  packages: { table: 'packages', keyColumn: 'id', fields: {} },
  siteSettings: { table: 'site_settings', keyColumn: 'id', fields: {} },
  paymentMethods: { table: 'payment_methods', keyColumn: 'id', fields: { active: 'active' } },
  qrisDisplaySettings: { table: 'qris_display_settings', keyColumn: 'id', fields: {} },
  vouchers: { table: 'vouchers', keyColumn: 'id', fields: {} },
  gifts: { table: 'gifts', keyColumn: 'id', fields: { ownerUid: 'owner_uid', editTokenHash: 'edit_token_hash', createdUnderSubscriptionId: 'created_under_subscription_id', slug: 'slug' } },
  giftRevisions: { table: 'gift_revisions', keyColumn: 'revision_number', fields: { giftId: 'gift_id' } },
  publicGifts: { table: 'public_gifts', keyColumn: 'slug', fields: {} },
  slugs: { table: 'slug_reservations', keyColumn: 'slug', fields: { giftId: 'gift_id', ownerUid: 'owner_uid', orderId: 'order_id' } },
  giftAnalytics: { table: 'gift_analytics', keyColumn: 'slug', fields: {} },
  orders: { table: 'orders', keyColumn: 'id', fields: { userId: 'user_id', giftId: 'gift_id', status: 'status', deletedAt: 'deleted_at' } },
  paymentTransactionClaims: { table: 'payment_transaction_claims', keyColumn: 'transaction_hash', fields: { orderId: 'order_id' } },
  paymentProofClaims: { table: 'payment_proof_claims', keyColumn: 'file_hash', fields: { orderId: 'order_id' } },
  subscriptions: { table: 'subscriptions', keyColumn: 'id', fields: { userId: 'user_id', orderId: 'order_id', status: 'status' } },
  subscriptionSchedules: { table: 'subscription_schedules', keyColumn: 'user_id', fields: {} },
  guestOrderIdempotency: { table: 'guest_order_idempotency', keyColumn: 'key_hash', fields: { giftId: 'gift_id', orderId: 'order_id' } },
  guestEditRecoveries: { table: 'guest_edit_recoveries', keyColumn: 'token_hash', fields: { giftId: 'gift_id', ownerUid: 'owner_uid' } },
  guestEditLinks: { table: 'guest_edit_links', keyColumn: 'token_hash', fields: { giftId: 'gift_id', orderId: 'order_id' } },
  giftMedia: { table: 'gift_media', keyColumn: 'id', fields: { giftId: 'gift_id', ownerUid: 'owner_uid', storagePath: 'storage_path' } },
  rateLimits: { table: 'rate_limits', keyColumn: 'bucket_hash', fields: {} },
  adminAuditLogs: { table: 'admin_audit_logs', keyColumn: 'id', fields: { orderId: 'order_id' } },
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    const parsed = value.toMillis();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  const ms = toMillis(value);
  return ms === null ? null : new Date(ms);
}

function timestamp(value: unknown): { toMillis: () => number } | null {
  const ms = toMillis(value);
  return ms === null ? null : { toMillis: () => ms };
}

function decodeSegment(value: string): string {
  try { return decodeURIComponent(value); } catch { throw new Error('invalid_document_path'); }
}

function parsePath(path: string): PathInfo {
  const parts = path.split('/');
  if (parts.some((part) => !part)) throw new Error('invalid_document_path');

  if (parts.length === 4 && parts[0] === 'gifts' && parts[2] === 'revisions') {
    const giftId = decodeSegment(parts[1]);
    const revision = Number(parts[3]);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('invalid_document_path');
    return {
      collection: 'giftRevisions', table: 'gift_revisions',
      keys: { gift_id: giftId, revision_number: String(revision) },
      keyColumns: ['gift_id', 'revision_number'], keyValues: [giftId, revision],
      documentId: `${giftId}/${revision}`,
    };
  }

  if (parts.length !== 2 || !COLLECTIONS[parts[0]]) throw new Error('unsupported_document_path');
  const collection = parts[0];
  const definition = COLLECTIONS[collection];
  const rawId = decodeSegment(parts[1]);
  const key = collection === 'subscriptionSchedules' ? decodeSegment(parts[1]) : rawId;
  return {
    collection,
    table: definition.table,
    keys: { [definition.keyColumn]: key },
    keyColumns: [definition.keyColumn],
    keyValues: [key],
    documentId: rawId,
  };
}

function dbValue(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return new Date(value.toMillis());
  }
  return value;
}

function put(out: Row, key: string, value: unknown) {
  if (value !== undefined) out[key] = dbValue(value);
}

// Convert a domain document or partial update into explicit relational columns.
function encode(info: PathInfo, data: Doc): Row {
  const out: Row = { ...info.keys };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(data, key);
  const field = (domain: string, column: string) => { if (has(domain)) put(out, column, data[domain]); };

  switch (info.collection) {
    case 'packages':
      for (const [domain, column] of Object.entries({ name: 'name', priceIdr: 'price_idr', durationDays: 'duration_days', active: 'active', sortOrder: 'sort_order', limits: 'limits', createdAt: 'created_at', updatedAt: 'updated_at', updatedBy: 'updated_by', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'siteSettings':
      field('value', 'value'); field('updatedAt', 'updated_at'); field('updatedBy', 'updated_by'); field('schemaVersion', 'schema_version');
      break;
    case 'paymentMethods':
      for (const [domain, column] of Object.entries({ name: 'name', instructions: 'instructions', active: 'active', sortOrder: 'sort_order', paymentType: 'payment_type', providerName: 'provider_name', accountNumber: 'account_number', accountHolder: 'account_holder', imageUrl: 'image_url', imagePath: 'image_path', qrisDetectionStatus: 'qris_detection_status', createdAt: 'created_at', updatedAt: 'updated_at', updatedBy: 'updated_by', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'qrisDisplaySettings':
      field('config', 'config'); field('updatedAt', 'updated_at'); field('updatedBy', 'updated_by'); field('schemaVersion', 'schema_version');
      break;
    case 'vouchers': {
      field('code', 'code'); field('active', 'active'); field('deleted', 'deleted'); field('maxUses', 'max_uses'); field('usedCount', 'used_count');
      field('minimumAmountIdr', 'min_amount_idr'); field('updatedBy', 'updated_by'); field('createdAt', 'created_at'); field('updatedAt', 'updated_at'); field('deletedAt', 'deleted_at'); field('schemaVersion', 'schema_version');
      if (has('discount')) {
        const discount = data.discount as Record<string, unknown> | null;
        if (!discount || (discount.kind !== 'percent' && discount.kind !== 'fixed')) throw new Error('invalid_voucher_discount');
        out.discount_type = discount.kind;
        out.discount_value = discount.kind === 'percent' ? discount.value : discount.valueIdr;
      }
      if (has('startsAtMs')) out.starts_at = data.startsAtMs === null ? null : asDate(data.startsAtMs);
      if (has('expiresAtMs')) out.expires_at = data.expiresAtMs === null ? null : asDate(data.expiresAtMs);
      break;
    }
    case 'gifts':
      for (const [domain, column] of Object.entries({ ownerUid: 'owner_uid', editTokenHash: 'edit_token_hash', editTokenExpiresAt: 'edit_token_expires_at', customerEmail: 'customer_email', customerWhatsapp: 'customer_whatsapp', templateId: 'template_id', templateVersion: 'template_version', slug: 'slug', status: 'status', publishedRevision: 'published_revision', publishedAt: 'published_at', createdUnderSubscriptionId: 'created_under_subscription_id', createdAt: 'created_at', updatedAt: 'updated_at', archivedAt: 'archived_at', deletedAt: 'deleted_at', schemaVersion: 'schema_version' })) field(domain, column);
      if (has('draft')) {
        const draft = data.draft as Record<string, unknown> | null;
        if (!draft || typeof draft !== 'object') throw new Error('invalid_gift_draft');
        out.draft_content = draft.content;
        out.draft_version = draft.version;
        out.draft_updated_at = dbValue(draft.updatedAt);
      }
      break;
    case 'giftRevisions':
      field('content', 'content'); field('templateId', 'template_id'); field('templateVersion', 'template_version'); field('createdAt', 'created_at');
      break;
    case 'publicGifts':
      for (const [domain, column] of Object.entries({ status: 'status', templateId: 'template_id', templateVersion: 'template_version', revision: 'revision', content: 'content', publishedAt: 'published_at', updatedAt: 'updated_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'slugs':
      field('giftId', 'gift_id'); field('ownerUid', 'owner_uid'); field('createdAt', 'created_at'); field('expiresAt', 'expires_at'); field('orderId', 'order_id');
      break;
    case 'giftAnalytics':
      field('totalViews', 'total_views'); field('firstViewedAt', 'first_viewed_at'); field('lastViewedAt', 'last_viewed_at'); field('viewsByDay', 'views_by_day'); field('schemaVersion', 'schema_version');
      break;
    case 'orders':
      for (const [domain, column] of Object.entries({ userId: 'user_id', giftId: 'gift_id', customerEmail: 'customer_email', customerWhatsapp: 'customer_whatsapp', packageId: 'package_id', paymentMethodId: 'payment_method_id', paymentMethodSnapshot: 'payment_method_snapshot', orderAccessTokenHash: 'order_access_token_hash', orderAccessTokenPreviousHashes: 'order_access_token_previous_hashes', voucherCode: 'voucher_code', packageSnapshot: 'package_snapshot', originalAmountIdr: 'original_amount_idr', discountIdr: 'discount_idr', amountIdr: 'amount_idr', status: 'status', reviewedBy: 'reviewed_by', reviewedAt: 'reviewed_at', rejectionReason: 'rejection_reason', subscriptionId: 'subscription_id', createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at', deletedByUid: 'deleted_by_uid', schemaVersion: 'schema_version' })) field(domain, column);
      if (has('proof')) {
        const proof = data.proof as Record<string, unknown> | null;
        out.proof_storage_path = proof?.storagePath ?? null;
        out.proof_content_type = proof?.contentType ?? null;
        out.proof_size_bytes = proof?.sizeBytes ?? null;
        out.proof_submitted_at = dbValue(proof?.submittedAt ?? null);
      }
      field('proofAiVerification', 'proof_ai_verification');
      break;
    case 'paymentTransactionClaims':
      field('orderId', 'order_id'); field('createdAt', 'created_at');
      break;
    case 'paymentProofClaims':
      field('orderId', 'order_id'); field('createdAt', 'created_at');
      break;
    case 'subscriptions':
      for (const [domain, column] of Object.entries({ userId: 'user_id', packageId: 'package_id', orderId: 'order_id', status: 'status', startedAt: 'started_at', expiresAt: 'expires_at', packageSnapshot: 'package_snapshot', createdAt: 'created_at', updatedAt: 'updated_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'subscriptionSchedules':
      for (const [domain, column] of Object.entries({ userId: 'user_id', lastSubscriptionId: 'last_subscription_id', lastStartedAt: 'last_started_at', lastExpiresAt: 'last_expires_at', updatedAt: 'updated_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'guestOrderIdempotency':
      for (const [domain, column] of Object.entries({ ownerUid: 'owner_uid', giftId: 'gift_id', orderId: 'order_id', createdAt: 'created_at', expiresAt: 'expires_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'guestEditRecoveries':
      for (const [domain, column] of Object.entries({ giftId: 'gift_id', ownerUid: 'owner_uid', channel: 'channel', destinationHash: 'destination_hash', status: 'status', createdAt: 'created_at', expiresAt: 'expires_at', sentAt: 'sent_at', failedAt: 'failed_at', usedAt: 'used_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'guestEditLinks':
      for (const [domain, column] of Object.entries({ giftId: 'gift_id', ownerUid: 'owner_uid', orderId: 'order_id', issuedByAdminUid: 'issued_by_admin_uid', createdAt: 'created_at', expiresAt: 'expires_at', revokedAt: 'revoked_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'giftMedia':
      for (const [domain, column] of Object.entries({ giftId: 'gift_id', ownerUid: 'owner_uid', kind: 'kind', storagePath: 'storage_path', contentType: 'content_type', sizeBytes: 'size_bytes', createdAt: 'created_at', deletedAt: 'deleted_at', schemaVersion: 'schema_version' })) field(domain, column);
      break;
    case 'rateLimits':
      field('scope', 'scope'); field('count', 'count');
      if (has('windowStartedAtMs')) out.window_started_at = asDate(data.windowStartedAtMs);
      if (has('resetAtMs')) out.reset_at = asDate(data.resetAtMs);
      if (has('updatedAtMs')) out.updated_at = asDate(data.updatedAtMs);
      field('schemaVersion', 'schema_version');
      break;
    case 'adminAuditLogs': {
      const entity = inferAuditEntity(data);
      field('action', 'action'); field('actorUid', 'actor_uid'); field('reason', 'reason');
      if (has('at')) put(out, 'created_at', data.at);
      if (has('orderId')) field('orderId', 'order_id');
      out.entity_type = entity.type;
      out.entity_id = entity.id;
      const reserved = new Set(['action', 'actorUid', 'reason', 'at', 'orderId']);
      out.details = Object.fromEntries(Object.entries(data).filter(([key]) => !reserved.has(key)));
      break;
    }
    default:
      throw new Error('unsupported_collection');
  }

  // Avoid silent undefined values in SQL parameters while retaining explicit nulls.
  for (const [key, value] of Object.entries(out)) if (value === undefined) delete out[key];
  return out;
}

function inferAuditEntity(data: Doc): { type: string; id: string } {
  const candidates: [string, string][] = [
    ['order', 'orderId'], ['voucher', 'voucherCode'], ['payment_method', 'paymentMethodId'], ['package', 'packageId'],
  ];
  for (const [type, key] of candidates) {
    if (typeof data[key] === 'string') return { type, id: data[key] };
  }
  return { type: 'system', id: String(data.action ?? 'unknown') };
}

function fromDate(value: unknown): { toMillis: () => number } | null {
  return timestamp(value);
}

function decode(info: PathInfo, row: Row): Doc {
  const d = (key: string) => row[key];
  switch (info.collection) {
    case 'packages': return { name: d('name'), priceIdr: Number(d('price_idr')), durationDays: Number(d('duration_days')), active: d('active'), sortOrder: Number(d('sort_order')), limits: d('limits'), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), updatedBy: d('updated_by'), schemaVersion: d('schema_version') };
    case 'siteSettings': return { value: d('value'), updatedAt: fromDate(d('updated_at')), updatedBy: d('updated_by'), schemaVersion: Number(d('schema_version')) };
    case 'paymentMethods': return { name: d('name'), instructions: d('instructions'), active: d('active'), sortOrder: Number(d('sort_order')), paymentType: d('payment_type'), providerName: d('provider_name'), accountNumber: d('account_number'), accountHolder: d('account_holder'), imageUrl: d('image_url'), imagePath: d('image_path'), qrisDetectionStatus: d('qris_detection_status'), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), updatedBy: d('updated_by'), schemaVersion: d('schema_version') };
    case 'qrisDisplaySettings': return { config: d('config'), updatedAt: fromDate(d('updated_at')), updatedBy: d('updated_by'), schemaVersion: Number(d('schema_version')) };
    case 'vouchers': {
      const kind = d('discount_type');
      const discount = kind === 'percent' ? { kind, value: Number(d('discount_value')) } : { kind, valueIdr: Number(d('discount_value')) };
      return { code: d('code'), active: d('active'), deleted: d('deleted'), discount, startsAtMs: toMillis(d('starts_at')), expiresAtMs: toMillis(d('expires_at')), maxUses: d('max_uses') === null ? null : Number(d('max_uses')), usedCount: Number(d('used_count')), minimumAmountIdr: Number(d('min_amount_idr')), deletedAt: fromDate(d('deleted_at')), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), updatedBy: d('updated_by'), schemaVersion: d('schema_version') };
    }
    case 'gifts': return { ownerUid: d('owner_uid'), editTokenHash: d('edit_token_hash'), editTokenExpiresAt: fromDate(d('edit_token_expires_at')), customerEmail: d('customer_email'), customerWhatsapp: d('customer_whatsapp'), templateId: d('template_id'), templateVersion: Number(d('template_version')), slug: d('slug'), status: d('status'), draft: { content: d('draft_content'), version: Number(d('draft_version')), updatedAt: fromDate(d('draft_updated_at')) }, publishedRevision: d('published_revision') === null ? null : Number(d('published_revision')), publishedAt: fromDate(d('published_at')), createdUnderSubscriptionId: d('created_under_subscription_id'), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), archivedAt: fromDate(d('archived_at')), deletedAt: fromDate(d('deleted_at')), schemaVersion: d('schema_version') };
    case 'giftRevisions': return { number: Number(d('revision_number')), content: d('content'), templateId: d('template_id'), templateVersion: Number(d('template_version')), createdAt: fromDate(d('created_at')) };
    case 'publicGifts': return { slug: d('slug'), status: d('status'), templateId: d('template_id'), templateVersion: Number(d('template_version')), revision: Number(d('revision')), content: d('content'), publishedAt: fromDate(d('published_at')), updatedAt: fromDate(d('updated_at')), schemaVersion: d('schema_version') };
    case 'slugs': return { giftId: d('gift_id'), ownerUid: d('owner_uid'), createdAt: fromDate(d('created_at')), expiresAt: fromDate(d('expires_at')), orderId: d('order_id') };
    case 'giftAnalytics': return { slug: d('slug'), totalViews: Number(d('total_views')), firstViewedAt: fromDate(d('first_viewed_at')), lastViewedAt: fromDate(d('last_viewed_at')), viewsByDay: d('views_by_day'), schemaVersion: d('schema_version') };
    case 'paymentTransactionClaims':
    case 'paymentProofClaims': return { orderId: d('order_id'), createdAt: fromDate(d('created_at')) };
    case 'orders': {
      const proof = d('proof_storage_path') === null ? null : { storagePath: d('proof_storage_path'), contentType: d('proof_content_type'), sizeBytes: Number(d('proof_size_bytes')), submittedAt: fromDate(d('proof_submitted_at')) };
      return { userId: d('user_id'), giftId: d('gift_id'), customerEmail: d('customer_email'), customerWhatsapp: d('customer_whatsapp'), packageId: d('package_id'), paymentMethodId: d('payment_method_id'), paymentMethodSnapshot: d('payment_method_snapshot'), orderAccessTokenHash: d('order_access_token_hash'), orderAccessTokenPreviousHashes: d('order_access_token_previous_hashes'), voucherCode: d('voucher_code'), packageSnapshot: d('package_snapshot'), originalAmountIdr: d('original_amount_idr'), discountIdr: d('discount_idr'), amountIdr: Number(d('amount_idr')), status: d('status'), proof, proofAiVerification: d('proof_ai_verification'), reviewedBy: d('reviewed_by'), reviewedAt: fromDate(d('reviewed_at')), rejectionReason: d('rejection_reason'), subscriptionId: d('subscription_id'), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), deletedAt: fromDate(d('deleted_at')), deletedByUid: d('deleted_by_uid'), schemaVersion: d('schema_version') };
    }
    case 'subscriptions': return { userId: d('user_id'), packageId: d('package_id'), orderId: d('order_id') ?? null, status: d('status'), startedAt: fromDate(d('started_at')), expiresAt: fromDate(d('expires_at')), packageSnapshot: d('package_snapshot'), createdAt: fromDate(d('created_at')), updatedAt: fromDate(d('updated_at')), schemaVersion: d('schema_version') };
    case 'subscriptionSchedules': return { userId: d('user_id'), lastSubscriptionId: d('last_subscription_id'), lastStartedAt: fromDate(d('last_started_at')), lastExpiresAt: fromDate(d('last_expires_at')), updatedAt: fromDate(d('updated_at')), schemaVersion: d('schema_version') };
    case 'guestOrderIdempotency': return { ownerUid: d('owner_uid'), giftId: d('gift_id'), orderId: d('order_id'), createdAt: fromDate(d('created_at')), expiresAt: fromDate(d('expires_at')), schemaVersion: d('schema_version') };
    case 'guestEditRecoveries': return { giftId: d('gift_id'), ownerUid: d('owner_uid'), channel: d('channel'), destinationHash: d('destination_hash'), status: d('status'), createdAt: fromDate(d('created_at')), expiresAt: fromDate(d('expires_at')), sentAt: fromDate(d('sent_at')), failedAt: fromDate(d('failed_at')), usedAt: fromDate(d('used_at')), schemaVersion: d('schema_version') };
    case 'guestEditLinks': return { giftId: d('gift_id'), ownerUid: d('owner_uid'), orderId: d('order_id'), issuedByAdminUid: d('issued_by_admin_uid'), createdAt: fromDate(d('created_at')), expiresAt: fromDate(d('expires_at')), revokedAt: fromDate(d('revoked_at')), schemaVersion: d('schema_version') };
    case 'giftMedia': return { giftId: d('gift_id'), ownerUid: d('owner_uid'), kind: d('kind'), storagePath: d('storage_path'), contentType: d('content_type'), sizeBytes: Number(d('size_bytes')), createdAt: fromDate(d('created_at')), deletedAt: fromDate(d('deleted_at')), schemaVersion: d('schema_version') };
    case 'rateLimits': return { scope: d('scope'), count: Number(d('count')), windowStartedAtMs: toMillis(d('window_started_at')), resetAtMs: toMillis(d('reset_at')), updatedAtMs: toMillis(d('updated_at')), schemaVersion: d('schema_version') };
    case 'adminAuditLogs': return { ...(d('details') as Record<string, unknown>), action: d('action'), actorUid: d('actor_uid'), orderId: d('order_id'), reason: d('reason'), at: fromDate(d('created_at')) };
    default: throw new Error('unsupported_collection');
  }
}

function keyFor(info: PathInfo, row: Row): string {
  if (info.collection === 'giftRevisions') return `${String(row.gift_id)}/${String(row.revision_number)}`;
  return String(row[info.keyColumns[0]]);
}

function fieldColumn(collection: string, field: string): string {
  const definition = COLLECTIONS[collection];
  if (!definition) throw new Error('unsupported_collection');
  if (field === definition.keyColumn || field === 'id') return definition.keyColumn;
  const column = definition.fields[field];
  if (!column) throw new Error('unsupported_query_field');
  return column;
}

async function readOne(tx: TransactionSql, info: PathInfo): Promise<Row | null> {
  const predicates = info.keyColumns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(' and ');
  // Parameters are constrained to values produced by the static domain encoders above.
  const rows = await tx.unsafe(`select * from public.${quoteIdentifier(info.table)} where ${predicates} limit 1`, info.keyValues as never[]);
  return (rows[0] as unknown as Row | undefined) ?? null;
}

async function applyWrite(tx: TransactionSql, write: PendingWrite) {
  const info = parsePath(write.path);
  if (write.kind === 'delete') {
    const predicates = info.keyColumns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(' and ');
    await tx.unsafe(`delete from public.${quoteIdentifier(info.table)} where ${predicates}`, info.keyValues as never[]);
    return;
  }
  const record = encode(info, write.data);
  const columns = Object.keys(record);
  if (write.kind === 'update' && columns.every((column) => info.keyColumns.includes(column))) return;
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const values = columns.map((column) => record[column]);
  const tableSql = `public.${quoteIdentifier(info.table)}`;

  if (write.kind === 'create') {
    await tx.unsafe(`insert into ${tableSql} (${columnSql}) values (${placeholders})`, values as never[]);
    return;
  }

  if (write.kind === 'set') {
    const updates = columns.filter((column) => !info.keyColumns.includes(column));
    const conflict = info.keyColumns.map(quoteIdentifier).join(', ');
    const action = updates.length
      ? `do update set ${updates.map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(', ')}`
      : 'do nothing';
    await tx.unsafe(`insert into ${tableSql} (${columnSql}) values (${placeholders}) on conflict (${conflict}) ${action}`, values as never[]);
    return;
  }

  const updateColumns = columns.filter((column) => !info.keyColumns.includes(column));
  const setSql = updateColumns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ');
  const result = await tx.unsafe(`update ${tableSql} set ${setSql} where ${info.keyColumns.map((column, index) => `${quoteIdentifier(column)} = $${updateColumns.length + index + 1}`).join(' and ')}`, [...updateColumns.map((column) => record[column]), ...info.keyValues] as never[]);
  if (result.count === 0) throw new Error('document_not_found');
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code: unknown }).code;
  // Unique conflicts can be normal races for idempotency and slug reservation;
  // retrying re-runs the domain callback, which then observes the winning row.
  return code === '40001' || code === '40P01' || code === '23505';
}

/**
 * PostgreSQL implementation of the existing path-based Store. Operations are
 * run in SERIALIZABLE transactions; writes are buffered until the domain
 * callback completes to preserve the existing all-reads-before-writes rule.
 */
export function postgresStore(database: Sql): Store {
  return {
    async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await database.begin(async (transaction) => {
            const tx = transaction as TransactionSql;
            await tx.unsafe('set transaction isolation level serializable');
            const writes: PendingWrite[] = [];
            let writesStarted = false;
            const assertReadAllowed = () => { if (writesStarted) throw new Error('transaction_read_after_write'); };
            const addWrite = (kind: WriteKind, path: string, data: Doc) => {
              parsePath(path);
              writesStarted = true;
              writes.push({ kind, path, data });
            };
            const adapter: Tx = {
              get: async (path) => {
                assertReadAllowed();
                const info = parsePath(path);
                const row = await readOne(tx, info);
                return row ? decode(info, row) : null;
              },
              query: async (collection, field, value) => {
                assertReadAllowed();
                const definition = COLLECTIONS[collection];
                if (!definition) throw new Error('unsupported_collection');
                let query = `select * from public.${quoteIdentifier(definition.table)}`;
                const values: unknown[] = [];
                if (field !== undefined) {
                  const column = fieldColumn(collection, field);
                  values.push(value);
                  query += ` where ${quoteIdentifier(column)} = $1`;
                }
                const rows = await tx.unsafe(query, values as never[]);
                const info: PathInfo = { collection, table: definition.table, keys: {}, keyColumns: [definition.keyColumn], keyValues: [], documentId: '' };
                return (rows as unknown as Row[]).map((row) => ({ id: keyFor(info, row), data: decode(info, row) }));
              },
              create: (path, data) => addWrite('create', path, data),
              set: (path, data) => addWrite('set', path, data),
              update: (path, data) => addWrite('update', path, data),
              delete: (path) => addWrite('delete', path, {}),
            };
            const result = await fn(adapter);
            for (const write of writes) await applyWrite(tx, write);
            return result;
          });
        } catch (error) {
          if (!isRetryable(error) || attempt >= RETRY_LIMIT) throw error;
          await new Promise((resolve) => setTimeout(resolve, 5 * (2 ** attempt)));
        }
      }
    },
  };
}
