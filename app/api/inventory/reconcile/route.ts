import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { reconcileStock } from '@/lib/services/inventory';
import { handleApiError } from '@/lib/api/errors';

const reconcileSchema = z
  .object({
    rawMaterialId: z.string().uuid().optional(),
    productVariantId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    actualQuantityOnHand: z.number(),
    note: z.string().optional(),
  })
  .refine((v) => [v.rawMaterialId, v.productVariantId, v.productId].filter(Boolean).length === 1, {
    message: 'Provide exactly one of rawMaterialId, productVariantId, or productId',
  });

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = reconcileSchema.parse(await request.json());
    const movement = await reconcileStock({ ...body, actorId: user.id });
    return NextResponse.json({ movement });
  } catch (error) {
    return handleApiError(error);
  }
}
