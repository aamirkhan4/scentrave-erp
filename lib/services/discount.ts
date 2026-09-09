import type { Discount } from '@prisma/client';
import { round2 } from '@/lib/services/tax';

export class InvalidDiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDiscountError';
  }
}

/** Validates a coupon is usable right now (active window, usage limit). Throws if not. */
export function assertDiscountUsable(discount: Discount, now: Date = new Date()) {
  if (!discount.isActive) throw new InvalidDiscountError(`Discount "${discount.code ?? discount.name}" is not active`);
  if (discount.startsAt && now < discount.startsAt) throw new InvalidDiscountError('Discount is not yet valid');
  if (discount.expiresAt && now > discount.expiresAt) throw new InvalidDiscountError('Discount has expired');
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    throw new InvalidDiscountError('Discount usage limit reached');
  }
}

/** Computes the discount amount for an order subtotal — FLAT/PERCENTAGE only. Use computeBuyXGetYDiscountAmount for that type. */
export function computeOrderDiscountAmount(discount: Discount, subtotal: number): number {
  if (discount.type === 'FLAT') {
    return Math.min(round2(Number(discount.value ?? 0)), subtotal);
  }
  if (discount.type === 'PERCENTAGE') {
    return round2((subtotal * Number(discount.value ?? 0)) / 100);
  }
  return 0;
}

export interface DiscountEligibleLine {
  quantity: number;
  unitPrice: number;
  productId: string;
  categoryId: string;
}

/**
 * "Buy X, get Y free": for every (buyQuantity + getQuantity) eligible units
 * in the cart, getQuantity of them are free. Eligibility is scoped to a
 * single product (discount.productId) or a whole category (discount.categoryId).
 * The free units are valued at the eligible lines' quantity-weighted average
 * price, since a mixed cart within scope doesn't single out which SKU is "the free one".
 */
export function computeBuyXGetYDiscountAmount(discount: Discount, lines: DiscountEligibleLine[]): number {
  if (discount.type !== 'BUY_X_GET_Y' || !discount.buyQuantity || !discount.getQuantity) return 0;

  const eligible = lines.filter((l) =>
    discount.scope === 'PRODUCT' ? l.productId === discount.productId : discount.scope === 'CATEGORY' ? l.categoryId === discount.categoryId : false,
  );
  if (eligible.length === 0) return 0;

  const totalQty = eligible.reduce((sum, l) => sum + l.quantity, 0);
  const totalValue = eligible.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const avgUnitPrice = totalValue / totalQty;

  const groupSize = discount.buyQuantity + discount.getQuantity;
  const freeUnits = Math.floor(totalQty / groupSize) * discount.getQuantity;

  return round2(freeUnits * avgUnitPrice);
}
