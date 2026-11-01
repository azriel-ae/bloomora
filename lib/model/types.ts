/**
 * Bloomora data model (schema version 2).
 *
 * Time fields use a generic `T` so the same shapes work with firebase-admin
 * `Timestamp` on the server, the client SDK `Timestamp` in rules tests, and a
 * plain `{ toMillis() }` stub in unit tests. All new documents store real
 * Firestore Timestamps, never ISO strings.
 *
 * MODEL B (mandatory business rule)
 *   A package controls creating/editing privileges. It never controls the
 *   lifetime of a published gift. Nothing in `PublicGiftDoc` references a
 *   subscription, and there is deliberately no `expiresAt` on gifts.
 */

export type TimestampLike = { toMillis(): number };

export type PackageId = 'basic' | 'plus' | 'premium';
export type TemplateTier = 'core' | 'extended';

export interface PackageLimits {
  maxGifts: number;
  maxPhotos: number;
  music: boolean;
  priorityReview: boolean;
  allowedTemplateTiers: TemplateTier[];
}

/** packages/{packageId} - public read, server write only. */
export interface PackageDoc {
  id: PackageId;
  name: string;
  priceIdr: number;
  durationDays: number;
  active: boolean;
  sortOrder: number;
  limits: PackageLimits;
}

/** Terms frozen at order time so later package edits never change a purchase. */
export interface PackageSnapshot {
  packageId: PackageId;
  name: string;
  priceIdr: number;
  durationDays: number;
  limits: PackageLimits;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'proof_submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface OrderProof {
  /** Set only after Firebase Storage is provisioned. */
  storagePath: string | null;
  contentType: string;
  sizeBytes: number;
  submittedAt: TimestampLike;
}

/** orders/{orderId} - owner/admin read, server write only. */
export interface OrderDoc<T extends TimestampLike = TimestampLike> {
  userId: string;
  customerEmail: string | null;
  customerWhatsapp: string | null;
  packageId: PackageId;
  paymentMethodId: string;
  voucherCode: string | null;
  packageSnapshot: PackageSnapshot;
  amountIdr: number;
  status: OrderStatus;
  proof: (Omit<OrderProof, 'submittedAt'> & { submittedAt: T }) | null;
  reviewedBy: string | null;
  reviewedAt: T | null;
  rejectionReason: string | null;
  subscriptionId: string | null;
  createdAt: T;
  updatedAt: T;
  schemaVersion: 2;
}

/**
 * subscriptions/{subscriptionId} - owner/admin read, server write only.
 * "Expired" is derived from `expiresAt` versus server time; it is never a
 * stored status, so no cron job is needed for access to lapse correctly.
 */
export type SubscriptionStatus = 'active' | 'revoked';

export interface SubscriptionDoc<T extends TimestampLike = TimestampLike> {
  userId: string;
  packageId: PackageId;
  /** The approved order that created this subscription (paymentId). */
  orderId: string;
  status: SubscriptionStatus;
  startedAt: T;
  expiresAt: T;
  packageSnapshot: PackageSnapshot;
  createdAt: T;
  updatedAt: T;
  schemaVersion: 2;
}

export type GiftStatus = 'draft' | 'published' | 'archived' | 'deleted';

/** Template-driven content. Plain data only; never HTML or script. */
export interface GiftContent {
  fields: Record<string, string>;
  /** Ordered section ids as defined by the template engine. */
  sections: string[];
  /** Section-specific data, e.g. gallery captions or timeline entries. */
  data: Record<string, unknown>;
  /** Media references. Always empty while upload is disabled. */
  media: { id: string; kind: 'image' | 'audio'; path: string }[];
}

export interface GiftDraft<T extends TimestampLike = TimestampLike> {
  content: GiftContent;
  /** Optimistic concurrency counter; incremented on every draft save. */
  version: number;
  updatedAt: T;
}

/**
 * gifts/{giftId} - PRIVATE. Owner/admin read, server write only.
 * Holds the working draft and ownership. Never publicly readable.
 */
export interface GiftDoc<T extends TimestampLike = TimestampLike> {
  ownerUid: string;
  /** Guest ownership uses a synthetic owner id; plaintext tokens are never persisted. */
  editTokenHash: string | null;
  editTokenExpiresAt: T | null;
  customerEmail: string | null;
  customerWhatsapp: string | null;
  /** null only for migrated legacy drafts whose template is unknown. */
  templateId: string | null;
  templateVersion: number;
  /** Allocated at creation, stable for life, unguessable. */
  slug: string;
  status: GiftStatus;
  draft: GiftDraft<T>;
  /** Number of the immutable revision currently served publicly. */
  publishedRevision: number | null;
  publishedAt: T | null;
  createdUnderSubscriptionId: string | null;
  createdAt: T;
  updatedAt: T;
  archivedAt: T | null;
  deletedAt: T | null;
  schemaVersion: 2;
}

/** gifts/{giftId}/revisions/{n} - immutable snapshot taken at publish time. */
export interface GiftRevisionDoc<T extends TimestampLike = TimestampLike> {
  number: number;
  content: GiftContent;
  templateId: string;
  templateVersion: number;
  createdAt: T;
}

export type PublicGiftStatus = 'published' | 'archived' | 'removed';

/**
 * publicGifts/{slug} - server-written, readable by anyone via single get.
 * Contains no owner uid, email, order, or subscription information.
 */
export interface PublicGiftDoc<T extends TimestampLike = TimestampLike> {
  slug: string;
  status: PublicGiftStatus;
  templateId: string;
  templateVersion: number;
  revision: number;
  content: GiftContent;
  publishedAt: T;
  updatedAt: T;
  schemaVersion: 2;
}

/** giftAnalytics/{slug} - server-only aggregate; contains no visitor identity. */
export interface GiftAnalyticsDoc<T extends TimestampLike = TimestampLike> {
  slug: string;
  totalViews: number;
  firstViewedAt: T;
  lastViewedAt: T;
  /** Bounded by the number of days the link has received traffic. */
  viewsByDay: Record<string, number>;
  schemaVersion: 1;
}

/** slugs/{slug} - server-only reservation and slug -> gift mapping. */
export interface SlugDoc<T extends TimestampLike = TimestampLike> {
  giftId: string;
  ownerUid: string;
  createdAt: T;
}
