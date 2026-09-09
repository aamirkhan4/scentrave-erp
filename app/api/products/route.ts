import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { createProduct } from '@/lib/services/catalog';

/**
 * Product search for the POS/billing screen — by name or SKU, with live
 * stock. Grouped by product (one tile per perfume, its sizes nested
 * underneath — a Shopify-style product/variant picker) rather than one flat
 * row per SKU, so the same perfume doesn't show up three times over.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';
    const type = request.nextUrl.searchParams.get('type'); // 'PERFUME' | 'OIL' | null
    const sizeLabel = request.nextUrl.searchParams.get('sizeLabel') ?? undefined;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        type: type === 'PERFUME' || type === 'OIL' ? type : undefined,
        variants: { some: { isActive: true, sizeLabel } },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { variants: { some: { sku: { contains: query, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        variants: {
          where: { isActive: true, sizeLabel },
          include: { stockLevel: { select: { quantityOnHand: true } } },
          orderBy: [{ sizeMl: 'asc' }, { isTester: 'asc' }],
        },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    const sizeOptions = await prisma.productVariant.findMany({
      where: { isActive: true },
      distinct: ['sizeLabel'],
      select: { sizeLabel: true },
      orderBy: { sizeLabel: 'asc' },
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          sizeLabel: v.sizeLabel,
          sizeMl: Number(v.sizeMl),
          isTester: v.isTester,
          sellingPrice: v.sellingPrice,
          stockOnHand: v.stockLevel ? Number(v.stockLevel.quantityOnHand) : 0,
          lowStockThreshold: v.lowStockThreshold,
        })),
      })),
      sizeOptions: sizeOptions.map((s) => s.sizeLabel),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createProductSchema = z.object({
  subcategoryId: z.string().uuid(),
  type: z.enum(['PERFUME', 'OIL']),
  name: z.string().min(1),
  description: z.string().optional(),
  fragranceFamily: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createProductSchema.parse(await request.json());
    const product = await createProduct(body);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
