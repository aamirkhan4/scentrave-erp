import { prisma } from '@/lib/prisma';

const SINGLETON_ID = 'singleton';

/** The one row of business identity used across Billing. Falls back to sane defaults if somehow missing, rather than throwing mid-checkout. */
export async function getShopSettings() {
  const settings = await prisma.shopSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (settings) return settings;
  return prisma.shopSettings.create({
    data: { id: SINGLETON_ID, shopName: 'Scentrave', gstHomeState: 'Rajasthan', invoicePrefix: 'SCV' },
  });
}

export async function updateShopSettings(data: {
  shopName?: string;
  address?: string | null;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  gstHomeState?: string;
  invoicePrefix?: string;
  upiVpa?: string | null;
  upiPayeeName?: string | null;
}) {
  return prisma.shopSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, gstHomeState: 'Rajasthan', ...data },
    update: data,
  });
}
