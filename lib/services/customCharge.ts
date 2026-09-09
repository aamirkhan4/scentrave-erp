import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const CUSTOM_CHARGE_SKU = 'CUSTOM-CHARGE';

/**
 * A single reserved, hidden (isActive: false) catalog variant that custom-amount
 * bill lines attach to. It's never searchable at the POS or listed anywhere
 * (Products/Inventory/Cost & Stock all filter isActive: true) — it exists purely
 * so OrderItem can keep a normal required productVariantId, avoiding a much
 * larger nullable-relation change across reports/dashboard/returns. The
 * per-sale description shown on the invoice comes from OrderItem.customLabel,
 * not from this placeholder's own name.
 */
export async function getOrCreateCustomChargeVariant(tx: Tx) {
  const existing = await tx.productVariant.findUnique({ where: { sku: CUSTOM_CHARGE_SKU } });
  if (existing) return existing;

  const category = await tx.category.upsert({
    where: { slug: 'other' },
    create: { name: 'Other', slug: 'other', sortOrder: 999 },
    update: {},
  });
  const subcategory = await tx.subcategory.upsert({
    where: { categoryId_slug: { categoryId: category.id, slug: 'custom-charges' } },
    create: { categoryId: category.id, name: 'Custom Charges', slug: 'custom-charges', sortOrder: 0 },
    update: {},
  });
  const product = await tx.product.create({
    data: {
      subcategoryId: subcategory.id,
      type: 'OIL',
      name: 'Custom Charge',
      isActive: false,
    },
  });
  return tx.productVariant.create({
    data: {
      productId: product.id,
      sizeMl: 0,
      sizeLabel: 'Custom',
      sku: CUSTOM_CHARGE_SKU,
      sellingPrice: 0,
      isActive: false,
    },
  });
}
