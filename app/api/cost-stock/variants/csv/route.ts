import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireRole } from '@/lib/auth/session';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

async function loadVariants() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true },
    include: { product: { select: { id: true, name: true } }, stockLevel: { select: { quantityOnHand: true } } },
    orderBy: [{ product: { name: 'asc' } }, { sizeMl: 'asc' }],
  });
  return variants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    sku: v.sku,
    productName: v.product.name,
    sizeLabel: v.sizeLabel,
    costPrice: v.costPrice ? Number(v.costPrice) : null,
    sellingPrice: Number(v.sellingPrice),
    stockOnHand: v.stockLevel ? Number(v.stockLevel.quantityOnHand) : 0,
  }));
}

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const variants = await loadVariants();
    const csv = Papa.unparse(
      variants.map((v) => ({
        SKU: v.sku,
        Product: v.productName,
        Size: v.sizeLabel,
        'Cost Price': v.costPrice ?? '',
        'Selling Price': v.sellingPrice,
        'Stock On Hand': v.stockOnHand,
      })),
    );
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="product-cost-stock.csv"' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Bulk import matched by SKU only — never creates a product or size from a
 * sheet. Sizes stay locked to the standard preset chosen in the catalog;
 * this only updates cost/price/stock for sizes that already exist.
 * "Stock On Hand" is the true current count, same reconciliation semantics
 * as the raw-materials import.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const csvText = await request.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: `CSV parse error: ${parsed.errors[0].message}` }, { status: 400 });
    }

    const variants = await prisma.productVariant.findMany({ where: { isActive: true }, include: { stockLevel: true } });
    const bySku = new Map(variants.map((v) => [v.sku, v]));

    let updated = 0;
    const errors: string[] = [];

    for (const [i, row] of parsed.data.entries()) {
      const sku = row.SKU?.trim();
      if (!sku) continue;
      const variant = bySku.get(sku);
      if (!variant) {
        errors.push(`Row ${i + 2}: no matching SKU "${sku}"`);
        continue;
      }

      const costPrice = row['Cost Price'] !== undefined && row['Cost Price'] !== '' ? Number(row['Cost Price']) : undefined;
      const sellingPrice = row['Selling Price'] !== undefined && row['Selling Price'] !== '' ? Number(row['Selling Price']) : undefined;
      const stockOnHand = row['Stock On Hand'] !== undefined && row['Stock On Hand'] !== '' ? Number(row['Stock On Hand']) : undefined;

      await prisma.$transaction(async (tx) => {
        if (costPrice !== undefined || sellingPrice !== undefined) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { ...(costPrice !== undefined && !Number.isNaN(costPrice) ? { costPrice } : {}), ...(sellingPrice !== undefined && !Number.isNaN(sellingPrice) ? { sellingPrice } : {}) },
          });
        }
        if (stockOnHand !== undefined && !Number.isNaN(stockOnHand)) {
          const currentQty = variant.stockLevel ? Number(variant.stockLevel.quantityOnHand) : 0;
          const delta = stockOnHand - currentQty;
          if (delta !== 0) {
            await recordStockMovement(tx, {
              productVariantId: variant.id,
              quantityDelta: delta,
              reason: 'ADJUSTMENT',
              actorId: user.id,
              note: `Bulk import: set to ${stockOnHand}`,
              allowNegative: true,
            });
          }
        }
      });

      updated++;
    }

    const result = await loadVariants();
    return NextResponse.json({ variants: result, updated, errors });
  } catch (error) {
    return handleApiError(error);
  }
}
