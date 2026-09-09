import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

const schema = z.object({ quantity: z.number().positive(), note: z.string().optional() });

/** Records a raw material purchase (goods-in) against the stock ledger. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = schema.parse(await request.json());
    const movement = await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        rawMaterialId: params.id,
        quantityDelta: body.quantity,
        reason: 'PURCHASE',
        actorId: user.id,
        note: body.note,
      }),
    );
    return NextResponse.json({ movement });
  } catch (error) {
    return handleApiError(error);
  }
}
