import type { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { round2 } from '@/lib/services/tax';

type Tx = Prisma.TransactionClient;

export class OverpaymentError extends Error {
  constructor(remaining: number, attempted: number) {
    super(`Payment of ${attempted} exceeds the remaining balance of ${remaining}`);
    this.name = 'OverpaymentError';
  }
}

/**
 * Records one leg of a (possibly split) payment against an invoice and
 * recomputes the invoice's paid status from the sum of SUCCESS payments.
 * Cash/manual methods are recorded as SUCCESS immediately; UPI_DYNAMIC_QR
 * starts PENDING and is flipped to SUCCESS by the Razorpay webhook handler.
 */
export async function recordPayment(
  tx: Tx,
  input: {
    invoiceId: string;
    method: PaymentMethod;
    amount: number;
    status?: PaymentStatus;
    razorpayOrderId?: string;
  },
) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
    include: { order: true, payments: true },
  });

  const alreadyPaid = invoice.payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = round2(Number(invoice.order.total) - alreadyPaid);

  const status: PaymentStatus = input.status ?? (isImmediatelySettled(input.method) ? 'SUCCESS' : 'PENDING');

  if (status === 'SUCCESS' && input.amount > remaining + 0.01) {
    throw new OverpaymentError(remaining, input.amount);
  }

  const payment = await tx.payment.create({
    data: {
      invoiceId: input.invoiceId,
      method: input.method,
      amount: input.amount,
      status,
      razorpayOrderId: input.razorpayOrderId,
      paidAt: status === 'SUCCESS' ? new Date() : null,
    },
  });

  await recomputeInvoiceStatus(tx, input.invoiceId);

  return payment;
}

export async function recomputeInvoiceStatus(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: true, payments: true },
  });

  const paid = invoice.payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const total = Number(invoice.order.total);

  const status = paid <= 0 ? 'UNPAID' : paid + 0.01 >= total ? 'PAID' : 'PARTIALLY_PAID';

  if (status !== invoice.status) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}

function isImmediatelySettled(method: PaymentMethod): boolean {
  return method === 'CASH' || method === 'UPI_STATIC_QR' || method === 'CARD' || method === 'BANK_TRANSFER' || method === 'LOYALTY_POINTS';
}
