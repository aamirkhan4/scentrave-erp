import { prisma } from '@/lib/prisma';

export async function getPaymentReconciliation(since?: Date) {
  const invoices = await prisma.invoice.findMany({
    where: since ? { issuedAt: { gte: since } } : undefined,
    include: { order: true, payments: true },
    orderBy: { issuedAt: 'desc' },
  });

  const rows = invoices.map((inv) => {
    const successPayments = inv.payments.filter((p) => p.status === 'SUCCESS');
    const pendingPayments = inv.payments.filter((p) => p.status === 'PENDING');
    const paid = successPayments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      invoiceNumber: inv.invoiceNumber,
      total: Number(inv.order.total),
      paid,
      remaining: Number(inv.order.total) - paid,
      status: inv.status,
      matched: inv.status === 'PAID',
      pendingPaymentLegs: pendingPayments.length,
    };
  });

  return {
    rows,
    summary: {
      matchedCount: rows.filter((r) => r.matched).length,
      matchedTotal: rows.filter((r) => r.matched).reduce((s, r) => s + r.total, 0),
      pendingCount: rows.filter((r) => !r.matched).length,
      pendingTotal: rows.filter((r) => !r.matched).reduce((s, r) => s + r.remaining, 0),
    },
  };
}
