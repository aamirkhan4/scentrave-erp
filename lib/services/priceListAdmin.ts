import { prisma } from '@/lib/prisma';

export async function listPriceLists() {
  return prisma.priceList.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { items: true, customers: true } } } });
}

export async function createPriceList(input: { name: string; isDefault?: boolean }) {
  if (input.isDefault) {
    // only one default list at a time
    await prisma.priceList.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  return prisma.priceList.create({ data: input });
}

export interface PriceListItemRow {
  productVariantId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  defaultPrice: number;
  listPrice: number | null;
}

/** Every active variant, with this list's override price if one exists (else null = "using default"). */
export async function getPriceListItems(priceListId: string): Promise<PriceListItemRow[]> {
  const [variants, items] = await Promise.all([
    prisma.productVariant.findMany({ where: { isActive: true }, include: { product: true }, orderBy: { sku: 'asc' } }),
    prisma.priceListItem.findMany({ where: { priceListId } }),
  ]);
  const itemByVariant = new Map(items.map((i) => [i.productVariantId, i]));

  return variants.map((v) => ({
    productVariantId: v.id,
    sku: v.sku,
    productName: v.product.name,
    sizeLabel: v.sizeLabel,
    defaultPrice: Number(v.sellingPrice),
    listPrice: itemByVariant.has(v.id) ? Number(itemByVariant.get(v.id)!.price) : null,
  }));
}

/** Bulk-saves price overrides for a list; only writes rows that actually changed, and logs each change. */
export async function bulkUpsertPriceListItems(
  priceListId: string,
  rows: Array<{ productVariantId: string; price: number }>,
  changedById: string,
) {
  const existing = await prisma.priceListItem.findMany({ where: { priceListId } });
  const existingByVariant = new Map(existing.map((i) => [i.productVariantId, i]));

  return prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const current = existingByVariant.get(row.productVariantId);
      if (current && Number(current.price) === row.price) continue; // unchanged, skip

      await tx.priceListItem.upsert({
        where: { priceListId_productVariantId: { priceListId, productVariantId: row.productVariantId } },
        create: { priceListId, productVariantId: row.productVariantId, price: row.price },
        update: { price: row.price },
      });

      await tx.priceChangeLog.create({
        data: {
          priceListId,
          productVariantId: row.productVariantId,
          oldPrice: current ? current.price : 0,
          newPrice: row.price,
          changedById,
        },
      });
    }
  });
}
