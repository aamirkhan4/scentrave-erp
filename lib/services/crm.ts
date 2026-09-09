import { prisma } from '@/lib/prisma';

/** Full customer profile for the CRM detail screen: purchase history, LTV, timeline. */
export async function getCustomerProfile(customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      priceList: true,
      segments: true,
      orders: {
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED', 'RETURNED'] } },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { productVariant: { include: { product: true } } } }, invoice: true },
      },
      tasks: { orderBy: { dueAt: 'asc' } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      loyaltyLedger: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });

  const lifetimeValue = customer.orders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastPurchaseAt = customer.orders[0]?.createdAt ?? null;

  return { ...customer, lifetimeValue, lastPurchaseAt };
}
