import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 24;
const ALLOWED_PAGE_SIZES = [12, 24, 48, 96];

/**
 * Owner-facing audit view across every perfume's recipe — answers "what are
 * our current formulations, and which perfumes don't have one yet" in one
 * place, instead of opening each product individually in the catalog.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const requestedPageSize = Number(params.get('pageSize'));
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
    const search = params.get('search')?.trim() ?? '';
    const missingOnly = params.get('missingOnly') === '1';

    const where = {
      type: 'PERFUME' as const,
      isActive: true,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(missingOnly ? { formulas: { none: { isActive: true } } } : {}),
    };

    const [products, total, totalPerfumes, withFormula] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          subcategory: { include: { category: true } },
          formulas: {
            where: { isActive: true },
            include: { lines: { include: { rawMaterial: { select: { name: true, unit: true } } } } },
          },
        },
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { type: 'PERFUME', isActive: true } }),
      prisma.product.count({ where: { type: 'PERFUME', isActive: true, formulas: { some: { isActive: true } } } }),
    ]);

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: `${p.subcategory.category.name} → ${p.subcategory.name}`,
        formula: p.formulas[0]
          ? {
              version: p.formulas[0].version,
              lines: p.formulas[0].lines.map((l) => ({
                rawMaterialName: l.rawMaterial.name,
                unit: l.rawMaterial.unit,
                quantityPerMl: Number(l.quantityPerMl),
              })),
            }
          : null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: { totalPerfumes, withFormula, withoutFormula: totalPerfumes - withFormula },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
