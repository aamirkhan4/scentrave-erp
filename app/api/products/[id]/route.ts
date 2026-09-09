import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({ isActive: z.boolean() });

/** Reactivates a previously deleted (deactivated) product. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = updateSchema.parse(await request.json());
    const product = await prisma.product.update({ where: { id: params.id }, data: { isActive: body.isActive } });
    return NextResponse.json({ product });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Products carry sales/production history via `onDelete: Restrict` on their
 * variants, so a hard delete would fail (or silently orphan history) the
 * moment a product has ever been sold or produced. Deactivating hides it
 * from the catalog and POS everywhere without losing that history.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    await prisma.$transaction([
      prisma.product.update({ where: { id: params.id }, data: { isActive: false } }),
      prisma.productVariant.updateMany({ where: { productId: params.id }, data: { isActive: false } }),
    ]);
    return NextResponse.json({ deactivated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
