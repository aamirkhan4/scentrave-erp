import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 24;
const ALLOWED_PAGE_SIZES = [12, 24, 48, 96];

/**
 * Paginated, filterable product listing for the admin screen. The old
 * version loaded every product (with variants + formulas joined) in one
 * unbounded query and rendered all of them expanded at once — fine at
 * seed-data scale, unusable at 600+ real catalog products. Filtering by
 * size answers to a real gap: sizes are consistent (25ml/50ml/testers)
 * but there was no way to browse or manage the catalog by size at all.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const requestedPageSize = Number(params.get('pageSize'));
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
    const search = params.get('search')?.trim() ?? '';
    const subcategoryId = params.get('subcategoryId') ?? undefined;
    const sizeLabel = params.get('sizeLabel') ?? undefined;
    const includeInactive = params.get('includeInactive') === '1';

    const where = {
      isActive: includeInactive ? undefined : true,
      subcategoryId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { variants: { some: { sku: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...(sizeLabel ? { variants: { some: { sizeLabel, isActive: true } } } : {}),
    };

    const [products, total, sizeOptions] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          subcategory: { include: { category: true } },
          variants: { where: includeInactive ? undefined : { isActive: true }, orderBy: { sizeMl: 'asc' } },
          formulas: { where: { isActive: true }, include: { lines: { include: { rawMaterial: true } } } },
        },
      }),
      prisma.product.count({ where }),
      prisma.productVariant.findMany({
        where: { isActive: true },
        distinct: ['sizeLabel'],
        select: { sizeLabel: true },
        orderBy: { sizeLabel: 'asc' },
      }),
    ]);

    return NextResponse.json({
      products,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sizeOptions: sizeOptions.map((s) => s.sizeLabel),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
