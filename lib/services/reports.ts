import { prisma } from '@/lib/prisma';
import { computeTaxBreakup, round2 } from '@/lib/services/tax';
import { getShopSettings } from '@/lib/services/shopSettings';

/** 'UPI' groups both dynamic and static QR — the two ways a customer can pay by UPI at the counter. */
export type PaymentModeFilter = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER';

export interface SalesReportFilters {
  startDate?: Date;
  endDate?: Date;
  state?: string;
  paymentMode?: PaymentModeFilter;
}

export interface SalesReportRow {
  date: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  state: string;
  quantity: number;
  bankDetails: string | null;
  isIgst: boolean;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

const UPI_METHODS = new Set(['UPI_DYNAMIC_QR', 'UPI_STATIC_QR']);

/**
 * One row per line item sold (an order with 2 perfumes produces 2 rows
 * sharing the same order number) — the transactional view an owner reconciles
 * against a bank statement, as opposed to the product-aggregated totals a
 * merchandising report would use.
 */
export async function getSalesTransactionReport(filters: SalesReportFilters): Promise<SalesReportRow[]> {
  const shopSettings = await getShopSettings();
  const shopBankDetails = [shopSettings.upiPayeeName, shopSettings.upiVpa].filter(Boolean).join(' — ') || null;

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED', 'RETURNED'] },
      createdAt: { gte: filters.startDate, lte: filters.endDate },
      // Case-insensitive — customerState is free-typed at checkout (e.g. via guest details)
      // and isn't normalized, same reasoning as isInterState()'s comparison.
      customerState: filters.state ? { equals: filters.state, mode: 'insensitive' } : undefined,
    },
    include: {
      customer: true,
      items: { include: { productVariant: { include: { product: true } } } },
      invoice: { include: { payments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: SalesReportRow[] = [];
  for (const order of orders) {
    const successfulMethods = new Set(
      (order.invoice?.payments ?? []).filter((p) => p.status === 'SUCCESS').map((p) => p.method as string),
    );

    if (filters.paymentMode) {
      const matches =
        filters.paymentMode === 'UPI'
          ? [...successfulMethods].some((m) => UPI_METHODS.has(m))
          : successfulMethods.has(filters.paymentMode);
      if (!matches) continue;
    }

    const paidByUpi = [...successfulMethods].some((m) => UPI_METHODS.has(m));
    const customerName = order.customer?.name ?? order.guestName ?? 'Walk-in customer';

    for (const item of order.items) {
      const netQuantity = item.quantity - item.returnedQuantity;
      if (netQuantity <= 0) continue;

      const lineTotal = Number(item.lineTotal);
      const breakup = computeTaxBreakup(lineTotal, order.isIgst, Number(item.taxRate));

      rows.push({
        date: order.createdAt.toISOString(),
        orderNumber: order.orderNumber,
        productName: item.customLabel ?? `${item.productVariant.product.name} (${item.productVariant.sizeLabel})`,
        customerName,
        state: order.customerState,
        quantity: netQuantity,
        bankDetails: paidByUpi ? shopBankDetails : null,
        isIgst: order.isIgst,
        taxableAmount: round2(lineTotal - breakup.taxAmount),
        cgst: breakup.cgst,
        sgst: breakup.sgst,
        igst: breakup.igst,
        totalAmount: lineTotal,
      });
    }
  }

  return rows;
}

export function salesReportToCsvRows(rows: SalesReportRow[]): Record<string, string | number>[] {
  return rows.map((r) => ({
    Date: new Date(r.date).toLocaleDateString('en-IN'),
    'Order ID': r.orderNumber,
    Perfume: r.productName,
    'Customer Name': r.customerName,
    State: r.state,
    Quantity: r.quantity,
    'Bank Details (UPI)': r.bankDetails ?? '',
    'Taxable Amount (₹)': r.taxableAmount.toFixed(2),
    'CGST (₹)': r.cgst.toFixed(2),
    'SGST (₹)': r.sgst.toFixed(2),
    'IGST (₹)': r.igst.toFixed(2),
    'Total Amount (₹)': r.totalAmount.toFixed(2),
  }));
}
