import type { PaymentMethod, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
import { prisma } from '@/lib/prisma';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { resolveVariantPrice } from '@/lib/services/pricing';
import { getOrCreateCustomChargeVariant } from '@/lib/services/customCharge';
import { computeTaxBreakup, isInterState, DEFAULT_GST_RATE_PERCENT, round2 } from '@/lib/services/tax';
import {
  assertDiscountUsable,
  computeOrderDiscountAmount,
  computeBuyXGetYDiscountAmount,
  InvalidDiscountError,
} from '@/lib/services/discount';
import { createInvoiceForOrder } from '@/lib/services/invoice';
import { recordPayment } from '@/lib/services/payment';
import { redeemLoyaltyPoints, updateLoyaltyTierIfEarned } from '@/lib/services/loyalty';
import { currentFinancialYear, nextSequenceNumber, formatSequencedNumber } from '@/lib/services/sequence';

const LOYALTY_POINTS_PER_RUPEE_SPENT = 1 / 100; // 1 point per ₹100

export class EmptyCartError extends Error {
  constructor() {
    super('Order must have at least one item');
    this.name = 'EmptyCartError';
  }
}

export type CheckoutItemInput =
  | { productVariantId: string; quantity: number; custom?: false }
  | { custom: true; label: string; unitPrice: number; quantity: number };

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  amount: number;
}

export interface CheckoutInput {
  cashierId: string;
  customerId?: string;
  /** Typed at checkout with no Customer record created. If it matches an existing customer's phone, that customer is linked automatically (loyalty/price list still apply) — otherwise it's kept only as a snapshot on the order. */
  guestName?: string;
  guestPhone?: string;
  customerState: string;
  items: CheckoutItemInput[];
  discountCode?: string;
  payments: CheckoutPaymentInput[];
  /** true = park the bill (no stock deduction/invoice/payment yet); false = settle immediately. */
  hold?: boolean;
  /** Loyalty points to redeem against this order's total (customer must have this many). Adds a LOYALTY_POINTS payment leg automatically. */
  redeemPoints?: number;
}

interface PricedLine {
  productVariantId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  isTester: boolean;
  customLabel?: string;
}

async function priceCart(items: CheckoutItemInput[], customerId: string | undefined) {
  if (items.length === 0) throw new EmptyCartError();

  return prisma.$transaction(async (tx) => {
    const lines: PricedLine[] = [];
    for (const item of items) {
      if (item.custom) {
        const variant = await getOrCreateCustomChargeVariant(tx);
        const unitPrice = round2(item.unitPrice);
        lines.push({
          productVariantId: variant.id,
          productId: variant.productId,
          categoryId: '__custom-charge__', // never matches a real category, so category-scoped discounts correctly skip it
          quantity: item.quantity,
          unitPrice,
          lineSubtotal: round2(unitPrice * item.quantity),
          discountAmount: 0,
          taxRate: DEFAULT_GST_RATE_PERCENT,
          taxAmount: 0,
          lineTotal: 0,
          isTester: false,
          customLabel: item.label,
        });
        continue;
      }

      const variant = await tx.productVariant.findUniqueOrThrow({
        where: { id: item.productVariantId },
        include: { product: { include: { subcategory: true } } },
      });
      const unitPrice = await resolveVariantPrice(tx, item.productVariantId, customerId);
      const lineSubtotal = round2(unitPrice * item.quantity);
      lines.push({
        productVariantId: item.productVariantId,
        productId: variant.productId,
        categoryId: variant.product.subcategory.categoryId,
        quantity: item.quantity,
        unitPrice,
        lineSubtotal,
        discountAmount: 0,
        taxRate: DEFAULT_GST_RATE_PERCENT,
        taxAmount: 0,
        lineTotal: 0,
        isTester: variant.isTester,
      });
    }
    return lines;
  });
}

/**
 * Listed prices are tax-inclusive (MRP-style) — GST is already baked into
 * `unitPrice`, never added at checkout. `lineTotal` is therefore just the
 * post-discount price the customer pays; `taxAmount` is the GST portion
 * extracted from within that price, kept only for the invoice breakup and
 * GST filing (lib/services/reports.ts), and must never be added again.
 */
function applyOrderDiscountAndTax(lines: PricedLine[], orderDiscountAmount: number, isIgst: boolean): PricedLine[] {
  const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  return lines.map((line) => {
    const share = subtotal > 0 ? line.lineSubtotal / subtotal : 0;
    const discountAmount = round2(orderDiscountAmount * share);
    const grossAmount = line.lineSubtotal - discountAmount;
    const breakup = computeTaxBreakup(grossAmount, isIgst, line.taxRate);
    return {
      ...line,
      discountAmount,
      taxAmount: breakup.taxAmount,
      lineTotal: round2(grossAmount),
    };
  });
}

/** Direct checkout: prices the cart, deducts stock, creates the invoice, records payments, and awards loyalty — all in one transaction. */
export async function checkoutOrder(input: CheckoutInput) {
  const isIgst = await isInterState(input.customerState);

  // A typed guest phone that matches an existing Customer links them automatically
  // (loyalty/price list still apply) without the cashier ever searching for or saving one.
  const resolvedCustomerId =
    input.customerId ?? (input.guestPhone ? (await prisma.customer.findUnique({ where: { phone: input.guestPhone } }))?.id : undefined);

  let lines = await priceCart(input.items, resolvedCustomerId);

  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));

  let discount = null;
  let discountAmount = 0;
  if (input.discountCode) {
    discount = await prisma.discount.findUnique({ where: { code: input.discountCode } });
    if (!discount) throw new InvalidDiscountError(`Unknown discount code "${input.discountCode}"`);
    assertDiscountUsable(discount);
    discountAmount =
      discount.type === 'BUY_X_GET_Y' ? computeBuyXGetYDiscountAmount(discount, lines) : computeOrderDiscountAmount(discount, subtotal);
  }

  lines = applyOrderDiscountAndTax(lines, discountAmount, isIgst);
  const taxAmount = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

  return prisma.$transaction(async (tx) => {
    const financialYear = currentFinancialYear();
    const orderSequence = await nextSequenceNumber(tx, 'order', financialYear);
    const orderNumber = formatSequencedNumber('ORD', financialYear, orderSequence);

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: resolvedCustomerId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        cashierId: input.cashierId,
        status: input.hold ? 'DRAFT' : 'CONFIRMED',
        discountId: discount?.id,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        customerState: input.customerState,
        isIgst,
        parkedAt: input.hold ? new Date() : null,
        items: {
          create: lines.map((line) => ({
            productVariantId: line.productVariantId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
            customLabel: line.customLabel,
          })),
        },
      },
      include: { items: true },
    });

    if (input.hold) {
      return { order, invoice: null, payments: [] };
    }

    return settleOrder(tx, order.id, lines, input.cashierId, input.payments, discount?.id, input.redeemPoints);
  });
}

/** Resumes a previously held (DRAFT) order: deducts stock, creates the invoice, and records payments. */
export async function resumeHeldOrder(orderId: string, cashierId: string, payments: CheckoutPaymentInput[], redeemPoints?: number) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status !== 'DRAFT') {
      throw new Error(`Order ${order.orderNumber} is not held (status: ${order.status})`);
    }

    const lines: PricedLine[] = [];
    for (const item of order.items) {
      const variant = await tx.productVariant.findUniqueOrThrow({
        where: { id: item.productVariantId },
        include: { product: { include: { subcategory: true } } },
      });
      lines.push({
        productVariantId: item.productVariantId,
        productId: variant.productId,
        categoryId: variant.product.subcategory.categoryId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineSubtotal: Number(item.unitPrice) * item.quantity,
        discountAmount: Number(item.discountAmount),
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
        lineTotal: Number(item.lineTotal),
        isTester: false,
        customLabel: item.customLabel ?? undefined,
      });
    }

    return settleOrder(tx, order.id, lines, cashierId, payments, order.discountId ?? undefined, redeemPoints);
  });
}

async function settleOrder(
  tx: Tx,
  orderId: string,
  lines: PricedLine[],
  actorId: string,
  payments: CheckoutPaymentInput[],
  discountId?: string,
  redeemPoints?: number,
) {
  for (const line of lines) {
    if (line.customLabel) continue; // custom-amount charges aren't real inventory — nothing to deduct
    await recordStockMovement(tx, {
      productVariantId: line.productVariantId,
      quantityDelta: -line.quantity,
      reason: 'SALE',
      orderId,
      actorId,
      note: `Sold via order`,
    });
  }

  const invoice = await createInvoiceForOrder(tx, orderId);

  const allPayments: CheckoutPaymentInput[] = [...payments];
  if (redeemPoints && redeemPoints > 0) {
    const orderForRedemption = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!orderForRedemption.customerId) {
      throw new Error('Cannot redeem loyalty points on an order with no customer');
    }
    const rupeeValue = await redeemLoyaltyPoints(tx, { customerId: orderForRedemption.customerId, points: redeemPoints, orderId });
    allPayments.push({ method: 'LOYALTY_POINTS', amount: rupeeValue });
  }

  const recordedPayments = [];
  for (const p of allPayments) {
    recordedPayments.push(await recordPayment(tx, { invoiceId: invoice.id, method: p.method, amount: p.amount }));
  }

  await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED', parkedAt: null } });

  if (discountId) {
    await tx.discount.update({ where: { id: discountId }, data: { usageCount: { increment: 1 } } });
  }

  const orderForLoyalty = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (orderForLoyalty.customerId) {
    const eligibleTotal = lines
      .filter((l) => !l.isTester)
      .reduce((sum, l) => sum + l.lineTotal, 0);
    const points = Math.floor(eligibleTotal * LOYALTY_POINTS_PER_RUPEE_SPENT);
    if (points > 0) {
      await tx.loyaltyLedgerEntry.create({
        data: { customerId: orderForLoyalty.customerId, type: 'EARNED', points, orderId, note: `Earned from order ${orderForLoyalty.orderNumber}` },
      });
      await tx.customer.update({ where: { id: orderForLoyalty.customerId }, data: { loyaltyPoints: { increment: points } } });
    }
    await updateLoyaltyTierIfEarned(tx, orderForLoyalty.customerId);
  }

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { productVariant: { include: { product: true } } } },
      invoice: { include: { payments: true } },
      customer: true,
    },
  });

  return { order, invoice: order.invoice, payments: order.invoice?.payments ?? [] };
}
