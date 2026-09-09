import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

/**
 * Flat list of every sellable size with its cost, price, and current stock —
 * the "Cost & Stock" screen's product side. Deliberately unpaginated (same
 * reasoning as the price-list items endpoint): the JSON payload is small
 * even at ~2000 rows, and the screen paginates the *rendering* client-side
 * so it never mounts thousands of live inputs at once.
 */
export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true },
      include: { product: { select: { id: true, name: true } }, stockLevel: { select: { quantityOnHand: true } } },
      orderBy: [{ product: { name: 'asc' } }, { sizeMl: 'asc' }],
    });

    return NextResponse.json({
      variants: variants.map((v) => ({
        id: v.id,
        productId: v.product.id,
        sku: v.sku,
        productName: v.product.name,
        sizeLabel: v.sizeLabel,
        costPrice: v.costPrice ? Number(v.costPrice) : null,
        sellingPrice: Number(v.sellingPrice),
        stockOnHand: v.stockLevel ? Number(v.stockLevel.quantityOnHand) : 0,
        lowStockThreshold: v.lowStockThreshold,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
