import type { PackageDoc } from './model/types.ts';

export type VoucherDiscount =
  | { kind: 'percent'; value: number }
  | { kind: 'fixed'; valueIdr: number };

export interface VoucherDoc {
  code: string;
  active: boolean;
  discount: VoucherDiscount;
  startsAtMs: number | null;
  expiresAtMs: number | null;
  maxUses: number | null;
  usedCount: number;
  minimumAmountIdr: number;
}

export interface PaymentMethodDoc {
  id: string;
  name: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
}

export type VoucherResult =
  | { ok: true; code: string; discountIdr: number; finalAmountIdr: number }
  | { ok: false; reason: 'invalid' | 'inactive' | 'not_started' | 'expired' | 'usage_limit' | 'minimum_not_met' };

export function normalizeVoucherCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) : '';
}

export function validateVoucher(voucher: VoucherDoc, amountIdr: number, nowMs: number): VoucherResult {
  if (!voucher.active) return { ok: false, reason: 'inactive' };
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
  if (voucher.discount.kind === 'percent' && (!Number.isInteger(voucher.discount.value) || voucher.discount.value < 1 || voucher.discount.value > 100)) errors.push('invalid_percent');
  if (voucher.discount.kind === 'fixed' && (!Number.isInteger(voucher.discount.valueIdr) || voucher.discount.valueIdr < 1)) errors.push('invalid_fixed_amount');
  if (!Number.isInteger(voucher.minimumAmountIdr) || voucher.minimumAmountIdr < 0) errors.push('invalid_minimum');
  if (voucher.maxUses !== null && (!Number.isInteger(voucher.maxUses) || voucher.maxUses < 1)) errors.push('invalid_max_uses');
  if (voucher.startsAtMs !== null && voucher.expiresAtMs !== null && voucher.expiresAtMs <= voucher.startsAtMs) errors.push('invalid_date_range');
  return errors;
}

export function publicPaymentMethods(methods: readonly PaymentMethodDoc[]): PaymentMethodDoc[] {
  return methods.filter((method) => method.active).sort((a, b) => a.sortOrder - b.sortOrder).map((method) => ({ ...method }));
}

export function packageAmount(pkg: PackageDoc): number {
  return pkg.priceIdr;
}
