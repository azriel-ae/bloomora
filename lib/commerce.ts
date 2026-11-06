import type { PackageDoc } from './model/types.ts';

export type VoucherDiscount =
  | { kind: 'percent'; value: number }
  | { kind: 'fixed'; valueIdr: number };

export interface VoucherDoc {
  code: string;
  active: boolean;
  deleted?: boolean;
  discount: VoucherDiscount;
  startsAtMs: number | null;
  expiresAtMs: number | null;
  maxUses: number | null;
  usedCount: number;
  minimumAmountIdr: number;
}

export type PaymentMethodType = 'bank_transfer' | 'e_wallet' | 'qris' | 'other';

export type QrisFrameStyle = 'card' | 'minimal';
export type QrisDecoration = 'none' | 'petals' | 'ribbon';
export interface QrisDisplayConfig {
  title: string;
  description: string;
  backgroundColor: string;
  accentColor: string;
  borderColor: string;
  footer: string;
  logoUrl: string | null;
  frameStyle: QrisFrameStyle;
  decoration: QrisDecoration;
}

export const DEFAULT_QRIS_DISPLAY: QrisDisplayConfig = {
  title: 'Scan untuk membayar', description: 'Gunakan aplikasi pembayaran pilihanmu.',
  backgroundColor: '#fffaf3', accentColor: '#66745d', borderColor: '#d9d1c5',
  footer: 'Bloomora · pembayaran aman', logoUrl: null, frameStyle: 'card', decoration: 'none',
};

export interface PaymentMethodDoc {
  id: string;
  name: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
  paymentType?: PaymentMethodType;
  providerName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  qrisDisplay?: QrisDisplayConfig;
}

export function validateQrisDisplay(input: unknown): QrisDisplayConfig {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const text = (key: string, fallback: string, max: number) => typeof value[key] === 'string' ? value[key].trim().slice(0, max) : fallback;
  const color = (key: string, fallback: string) => typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key].toLowerCase() : fallback;
  const frameStyle = value.frameStyle === 'minimal' ? 'minimal' : 'card';
  const decoration = value.decoration === 'petals' || value.decoration === 'ribbon' ? value.decoration : 'none';
  return {
    title: text('title', DEFAULT_QRIS_DISPLAY.title, 100), description: text('description', DEFAULT_QRIS_DISPLAY.description, 300),
    backgroundColor: color('backgroundColor', DEFAULT_QRIS_DISPLAY.backgroundColor), accentColor: color('accentColor', DEFAULT_QRIS_DISPLAY.accentColor),
    borderColor: color('borderColor', DEFAULT_QRIS_DISPLAY.borderColor), footer: text('footer', DEFAULT_QRIS_DISPLAY.footer, 160),
    logoUrl: typeof value.logoUrl === 'string' && /^https?:\/\//i.test(value.logoUrl) ? value.logoUrl.slice(0, 500) : null,
    frameStyle, decoration,
  };
}

export type VoucherResult =
  | { ok: true; code: string; discountIdr: number; finalAmountIdr: number }
  | { ok: false; reason: 'invalid' | 'inactive' | 'not_started' | 'expired' | 'usage_limit' | 'minimum_not_met' };

export function normalizeVoucherCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) : '';
}

export function validateVoucher(voucher: VoucherDoc, amountIdr: number, nowMs: number): VoucherResult {
  if (!voucher.active || voucher.deleted) return { ok: false, reason: 'inactive' };
  if (voucher.startsAtMs !== null && nowMs < voucher.startsAtMs) return { ok: false, reason: 'not_started' };
  if (voucher.expiresAtMs !== null && nowMs >= voucher.expiresAtMs) return { ok: false, reason: 'expired' };
  if (voucher.maxUses !== null && voucher.usedCount >= voucher.maxUses) return { ok: false, reason: 'usage_limit' };
  if (amountIdr < voucher.minimumAmountIdr) return { ok: false, reason: 'minimum_not_met' };
  const discountIdr = voucher.discount.kind === 'percent'
    ? Math.min(amountIdr, Math.floor(amountIdr * voucher.discount.value / 100))
    : Math.min(amountIdr, voucher.discount.valueIdr);
  return { ok: true, code: voucher.code, discountIdr, finalAmountIdr: amountIdr - discountIdr };
}

export function validateVoucherDefinition(voucher: VoucherDoc): string[] {
  const errors: string[] = [];
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(voucher.code)) errors.push('invalid_code');
  if (!voucher.discount || (voucher.discount.kind !== 'percent' && voucher.discount.kind !== 'fixed')) errors.push('invalid_discount_kind');
  else if (voucher.discount.kind === 'percent' && (!Number.isInteger(voucher.discount.value) || voucher.discount.value < 1 || voucher.discount.value > 100)) errors.push('invalid_percent');
  else if (voucher.discount.kind === 'fixed' && (!Number.isInteger(voucher.discount.valueIdr) || voucher.discount.valueIdr < 1 || voucher.discount.valueIdr > 100_000_000)) errors.push('invalid_fixed_amount');
  if (!Number.isInteger(voucher.minimumAmountIdr) || voucher.minimumAmountIdr < 0 || voucher.minimumAmountIdr > 100_000_000) errors.push('invalid_minimum');
  if (!Number.isInteger(voucher.usedCount) || voucher.usedCount < 0) errors.push('invalid_used_count');
  if (voucher.maxUses !== null && (!Number.isInteger(voucher.maxUses) || voucher.maxUses < 1)) errors.push('invalid_max_uses');
  if (voucher.startsAtMs !== null && (!Number.isSafeInteger(voucher.startsAtMs) || voucher.startsAtMs < 0)) errors.push('invalid_start_date');
  if (voucher.expiresAtMs !== null && (!Number.isSafeInteger(voucher.expiresAtMs) || voucher.expiresAtMs < 0)) errors.push('invalid_expiry_date');
  if (voucher.startsAtMs !== null && voucher.expiresAtMs !== null && voucher.expiresAtMs <= voucher.startsAtMs) errors.push('invalid_date_range');
  if (typeof voucher.active !== 'boolean') errors.push('invalid_status');
  return errors;
}

export function publicPaymentMethods(methods: readonly PaymentMethodDoc[]): PaymentMethodDoc[] {
  return methods.filter((method) => method.active).sort((a, b) => a.sortOrder - b.sortOrder).map((method) => ({ ...method }));
}

export function packageAmount(pkg: PackageDoc): number {
  return pkg.priceIdr;
}
