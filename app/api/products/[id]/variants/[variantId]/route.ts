import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
});

/** Reactivates a variant, or edits its cost/selling price — the creation form only sets these once, and costs change over time. */
export async function PATCH(request: NextRequest, { params }: { params: { variantId: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = updateSchema.parse(await request.json());
    const variant = await prisma.productVariant.update({ where: { id: params.variantId }, data: body });
    return NextResponse.json({ variant });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Same reasoning as the product-level delete: a variant with any sale/production history can't be hard-deleted, so it's hidden instead. */
export async function DELETE(_request: Request, { params }: { params: { variantId: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    await prisma.productVariant.update({ where: { id: params.variantId }, data: { isActive: false } });
    return NextResponse.json({ deactivated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
