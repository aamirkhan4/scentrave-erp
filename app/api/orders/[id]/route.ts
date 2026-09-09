import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { deleteOrCancelOrder } from '@/lib/services/returns';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        items: { include: { productVariant: { include: { product: true } } } },
        invoice: { include: { payments: true } },
        customer: true,
      },
    });
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * A held bill is removed outright. A settled sale is cancelled instead —
 * stock is reversed and its invoice voided, but the record and its GST
 * invoice number stay on file. See deleteOrCancelOrder for why.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER');
    const result = await deleteOrCancelOrder({ orderId: params.id, actorId: user.id });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
