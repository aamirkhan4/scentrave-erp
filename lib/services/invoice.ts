import type { Prisma } from '@prisma/client';
import { currentFinancialYear, nextSequenceNumber, formatSequencedNumber } from '@/lib/services/sequence';

type Tx = Prisma.TransactionClient;

/** Creates the Invoice for a just-confirmed order, handing out the next FY-scoped sequential number atomically. */
export async function createInvoiceForOrder(tx: Tx, orderId: string) {
  const settings = await tx.shopSettings.findUnique({ where: { id: 'singleton' } });
  const invoicePrefix = settings?.invoicePrefix ?? 'SCV';

  const financialYear = currentFinancialYear();
  const sequence = await nextSequenceNumber(tx, 'invoice', financialYear);
  const invoiceNumber = formatSequencedNumber(invoicePrefix, financialYear, sequence);

  return tx.invoice.create({
    data: {
      invoiceNumber,
      financialYear,
      sequence,
      orderId,
      status: 'UNPAID',
    },
  });
}

interface OrderForInvoiceCustomer {
  guestName: string | null;
  guestPhone: string | null;
  customer: {
    name: string;
    phone: string;
    address: string | null;
    billingAddress: string | null;
    gstin: string | null;
  } | null;
}

/** BILL TO for the invoice PDF: prefers the linked Customer record; falls back to the plain name/phone typed at checkout when no Customer was linked (no address/GSTIN in that case, since none was ever collected). */
export function resolveInvoiceCustomer(order: OrderForInvoiceCustomer) {
  if (order.customer) {
    return {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.address,
      billingAddress: order.customer.billingAddress,
      gstin: order.customer.gstin,
    };
  }
  if (order.guestName) {
    return { name: order.guestName, phone: order.guestPhone, address: null, billingAddress: null, gstin: null };
  }
  return null;
}
