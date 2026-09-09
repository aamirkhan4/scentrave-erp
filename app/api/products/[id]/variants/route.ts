import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createProductVariant } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

const createSchema = z.object({
  sizeMl: z.number().positive(),
  sizeLabel: z.string().min(1),
  sku: z.string().min(1),
  isTester: z.boolean().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const variant = await createProductVariant({ productId: params.id, ...body });
    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
