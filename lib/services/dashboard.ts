import { startOfDay, startOfWeek, startOfMonth, subDays, eachDayOfInterval, format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { listStockLevels } from '@/lib/services/inventory';

async function sumOrderTotalsSince(since: Date): Promise<number> {
  const result = await prisma.order.aggregate({
    where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: since } },
    _sum: { total: true },
  });
  return Number(result._sum.total ?? 0);
}

export async function getDashboardSummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = subDays(todayStart, 1);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subDays(monthStart, 1));

  const trendStart = subDays(todayStart, 13);

  // Every branch below is independent of the others, so they're fired together
  // rather than awaited one at a time — sequential awaits here were the actual
  // cause of the multi-second load (each round trip pays the full latency to
  // the DB region, and there was nothing overlapping them).
  const [
    todaySales,
    yesterdaySales,
    weekSales,
    lastWeekSales,
    monthSales,
    lastMonthSales,
    topSellingLines,
    stockLevels,
    pendingInvoices,
    newCustomersToday,
    ordersForTrend,
    recentLines,
  ] = await Promise.all([
    sumOrderTotalsSince(todayStart),
    prisma.order
      .aggregate({
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { total: true },
      })
      .then((r) => Number(r._sum.total ?? 0)),
    sumOrderTotalsSince(weekStart),
    prisma.order
      .aggregate({
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: lastWeekStart, lt: weekStart } },
        _sum: { total: true },
      })
      .then((r) => Number(r._sum.total ?? 0)),
    sumOrderTotalsSince(monthStart),
    prisma.order
      .aggregate({
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: lastMonthStart, lt: monthStart } },
        _sum: { total: true },
      })
      .then((r) => Number(r._sum.total ?? 0)),
    prisma.orderItem.groupBy({
      by: ['productVariantId'],
      where: { order: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: subDays(now, 30) } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    listStockLevels(),
    prisma.invoice.findMany({
      where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      include: { order: true, payments: true },
    }),
    prisma.customer.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.findMany({
      where: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: trendStart } },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] }, createdAt: { gte: subDays(now, 30) } } },
      include: { productVariant: { include: { product: true } } },
    }),
  ]);

  const topVariants = await prisma.productVariant.findMany({
    where: { id: { in: topSellingLines.map((l) => l.productVariantId) } },
    include: { product: true },
  });
  const topSelling = topSellingLines.map((line) => {
    const variant = topVariants.find((v) => v.id === line.productVariantId);
    return {
      sku: variant?.sku ?? line.productVariantId,
      label: variant ? `${variant.product.name} — ${variant.sizeLabel}` : line.productVariantId,
      unitsSold: line._sum.quantity ?? 0,
      revenue: Number(line._sum.lineTotal ?? 0),
    };
  });

  const lowStockAlerts = stockLevels.filter((s) => s.isLow);

  const pendingPaymentsTotal = pendingInvoices.reduce((sum, inv) => {
    const paid = inv.payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + Number(p.amount), 0);
    return sum + (Number(inv.order.total) - paid);
  }, 0);

  const trendDays = eachDayOfInterval({ start: trendStart, end: todayStart });
  const salesTrend = trendDays.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const total = ordersForTrend
      .filter((o) => format(o.createdAt, 'yyyy-MM-dd') === dayKey)
      .reduce((sum, o) => sum + Number(o.total), 0);
    return { date: dayKey, total };
  });
  const categoryTotals = new Map<string, number>();
  const sizeTotals = new Map<string, number>();
  for (const line of recentLines) {
    const type = line.productVariant.product.type;
    categoryTotals.set(type, (categoryTotals.get(type) ?? 0) + Number(line.lineTotal));
    const size = line.productVariant.sizeLabel;
    sizeTotals.set(size, (sizeTotals.get(size) ?? 0) + Number(line.lineTotal));
  }

  return {
    sales: {
      today: todaySales,
      yesterday: yesterdaySales,
      week: weekSales,
      lastWeek: lastWeekSales,
      month: monthSales,
      lastMonth: lastMonthSales,
    },
    topSelling,
    lowStockAlerts,
    pendingPayments: { count: pendingInvoices.length, total: pendingPaymentsTotal },
    newCustomersToday,
    salesTrend,
    categoryBreakdown: Array.from(categoryTotals.entries()).map(([name, value]) => ({ name, value })),
    sizeBreakdown: Array.from(sizeTotals.entries()).map(([name, value]) => ({ name, value })),
  };
}
