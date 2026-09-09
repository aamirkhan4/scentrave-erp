import { NextRequest, NextResponse } from 'next/server';
import type { StockMovementReason } from '@prisma/client';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const VALID_REASONS: StockMovementReason[] = [
  'PURCHASE',
  'PRODUCTION_IN',
  'PRODUCTION_CONSUME',
  'MIX_IN',
  'BOTTLING_CONSUME',
  'SALE',
  'RETURN',
  'DAMAGE',
  'ADJUSTMENT',
  'OPENING_BALANCE',
];

/** Movement ledger for the inventory audit view — filterable by reason, with actor/batch/order context. */
export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const params = request.nextUrl.searchParams;
    const reasonParam = params.get('reason');
    const reason = VALID_REASONS.find((r) => r === reasonParam);

    const movements = await prisma.stockMovement.findMany({
      where: reason ? { reason } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        rawMaterial: { select: { name: true, unit: true } },
        productVariant: { select: { sku: true, sizeLabel: true, product: { select: { name: true } } } },
        product: { select: { name: true } },
        actor: { select: { name: true } },
        batch: { select: { batchNumber: true } },
        mixBatch: { select: { mixNumber: true } },
        order: { select: { orderNumber: true } },
      },
    });

    return NextResponse.json({ movements });
  } catch (error) {
    return handleApiError(error);
  }
}
