import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createBottlingBatch } from '@/lib/services/batch';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

const createBatchSchema = z.object({
  productVariantId: z.string().uuid(),
  quantityProduced: z.number().int().positive(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        productVariant: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ batches, requestedBy: user.id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = createBatchSchema.parse(await request.json());

    const batch = await createBottlingBatch({
      productVariantId: body.productVariantId,
      quantityProduced: body.quantityProduced,
      createdById: user.id,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      notes: body.notes,
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
