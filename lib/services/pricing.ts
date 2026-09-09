import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Resolves the price to charge for a variant: the customer's assigned price
 * list if they have one and it carries this variant, else the default price
 * list, else the variant's own sellingPrice.
 */
export async function resolveVariantPrice(tx: Tx, variantId: string, customerId?: string | null): Promise<number> {
  if (customerId) {
    const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { priceListId: true } });
    if (customer?.priceListId) {
      const item = await tx.priceListItem.findUnique({
        where: { priceListId_productVariantId: { priceListId: customer.priceListId, productVariantId: variantId } },
      });
      if (item) return Number(item.price);
    }
  }

  const defaultList = await tx.priceList.findFirst({ where: { isDefault: true, isActive: true } });
  if (defaultList) {
    const item = await tx.priceListItem.findUnique({
      where: { priceListId_productVariantId: { priceListId: defaultList.id, productVariantId: variantId } },
    });
    if (item) return Number(item.price);
  }

  const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  return Number(variant.sellingPrice);
}
