import { prisma } from '@/lib/prisma';
import { recordStockMovement } from '@/lib/services/stockMovement';

export interface StockRow {
  stockableType: 'RAW_MATERIAL' | 'PRODUCT_VARIANT' | 'BULK_LIQUID';
  id: string;
  name: string;
  quantityOnHand: number;
  threshold: number;
  isLow: boolean;
}

/** Full stock picture for the inventory screen: raw materials + bulk (unbottled) liquid + finished SKUs, one flat list. */
export async function listStockLevels(): Promise<StockRow[]> {
  const [rawMaterials, variants, bulkProducts] = await Promise.all([
    prisma.rawMaterial.findMany({ where: { isActive: true }, include: { stockLevel: true } }),
    prisma.productVariant.findMany({ where: { isActive: true }, include: { stockLevel: true, product: true } }),
    // Bulk liquid is only meaningful for products with a formula — that's the only path anything ever mixes into it.
    prisma.product.findMany({
      where: { isActive: true, formulas: { some: { isActive: true } } },
      include: { stockLevel: true },
    }),
  ]);

  const rawRows: StockRow[] = rawMaterials.map((rm) => {
    const qty = rm.stockLevel ? Number(rm.stockLevel.quantityOnHand) : 0;
    const threshold = Number(rm.lowStockThreshold);
    return { stockableType: 'RAW_MATERIAL', id: rm.id, name: `${rm.name} (${rm.unit})`, quantityOnHand: qty, threshold, isLow: qty <= threshold };
  });

  const variantRows: StockRow[] = variants.map((v) => {
    const qty = v.stockLevel ? Number(v.stockLevel.quantityOnHand) : 0;
    return {
      stockableType: 'PRODUCT_VARIANT',
      id: v.id,
      name: `${v.product.name} — ${v.sizeLabel} (${v.sku})`,
      quantityOnHand: qty,
      threshold: v.lowStockThreshold,
      isLow: qty <= v.lowStockThreshold,
    };
  });

  const bulkRows: StockRow[] = bulkProducts.map((p) => {
    const qty = p.stockLevel ? Number(p.stockLevel.quantityOnHand) : 0;
    return { stockableType: 'BULK_LIQUID', id: p.id, name: `${p.name} — bulk liquid (ml)`, quantityOnHand: qty, threshold: 0, isLow: false };
  });

  return [...rawRows, ...bulkRows, ...variantRows].sort((a, b) => (a.isLow === b.isLow ? 0 : a.isLow ? -1 : 1));
}

/**
 * Reconciliation entry point: the operator counts physical stock and enters
 * the true quantity; this computes the delta against the ledger's current
 * total and writes a single ADJUSTMENT movement to close the gap.
 */
export async function reconcileStock(input: {
  rawMaterialId?: string;
  productVariantId?: string;
  productId?: string;
  actualQuantityOnHand: number;
  actorId: string;
  note?: string;
}) {
  const { rawMaterialId, productVariantId, productId, actualQuantityOnHand, actorId, note } = input;
  const levelWhere = rawMaterialId ? { rawMaterialId } : productVariantId ? { productVariantId } : { productId: productId! };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockLevel.findFirst({ where: levelWhere });
    const currentQty = existing ? Number(existing.quantityOnHand) : 0;
    const delta = actualQuantityOnHand - currentQty;

    if (delta === 0) return null; // nothing to reconcile

    return recordStockMovement(tx, {
      rawMaterialId,
      productVariantId,
      productId,
      quantityDelta: delta,
      reason: 'ADJUSTMENT',
      actorId,
      note: note ?? `Reconciliation: counted ${actualQuantityOnHand}, ledger had ${currentQty}`,
      allowNegative: true,
    });
  });
}
