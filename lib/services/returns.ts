import { prisma } from '@/lib/prisma';
import { recordStockMovement } from '@/lib/services/stockMovement';

export class InvalidReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReturnError';
  }
}

export interface ReturnLineInput {
  orderItemId: string;
  quantity: number;
}

/**
 * Processes a partial or full return: validates each line against what's
 * still returnable, reverses stock for exactly the returned quantity, and
 * updates the order's status. Refund/payment reversal is a separate manual
 * step for the cashier (cash back, UPI refund, etc.) — not automated here.
 */
export async function processReturn(input: { orderId: string; lines: ReturnLineInput[]; actorId: string; note?: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } });
    if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_RETURNED') {
      throw new InvalidReturnError(`Order ${order.orderNumber} cannot be returned (status: ${order.status})`);
    }

    for (const line of input.lines) {
      const item = order.items.find((i) => i.id === line.orderItemId);
      if (!item) throw new InvalidReturnError(`Order item ${line.orderItemId} not found on this order`);

      const returnable = item.quantity - item.returnedQuantity;
      if (line.quantity <= 0 || line.quantity > returnable) {
        throw new InvalidReturnError(
          `Cannot return ${line.quantity} of item ${item.id}: only ${returnable} returnable`,
        );
      }

      if (!item.customLabel) {
        // Custom-amount charges aren't real inventory — nothing to restock.
        await recordStockMovement(tx, {
          productVariantId: item.productVariantId,
          quantityDelta: line.quantity,
          reason: 'RETURN',
          orderId: order.id,
          actorId: input.actorId,
          note: input.note ?? `Return against order ${order.orderNumber}`,
        });
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: { returnedQuantity: { increment: line.quantity } },
      });
    }

    const refreshedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
    const fullyReturned = refreshedItems.every((i) => i.returnedQuantity >= i.quantity);
    const anyReturned = refreshedItems.some((i) => i.returnedQuantity > 0);

    await tx.order.update({
      where: { id: order.id },
      data: { status: fullyReturned ? 'RETURNED' : anyReturned ? 'PARTIALLY_RETURNED' : order.status },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, invoice: { include: { payments: true } } },
    });
  });
}

/**
 * "Deletes" a bill. A held (DRAFT) bill never had stock deducted or an
 * invoice issued, so it's removed outright. A settled bill already carries
 * a sequential GST invoice number — erasing that row would leave a gap in
 * the audit trail, so it's cancelled instead: remaining stock is reversed
 * (same mechanism as a full return) and the invoice is voided, but the
 * order and invoice numbers stay on record.
 */
export async function deleteOrCancelOrder(input: { orderId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } });

    if (order.status === 'DRAFT') {
      await tx.order.delete({ where: { id: order.id } });
      return { deleted: true as const, cancelled: false as const };
    }

    if (order.status === 'RETURNED' || order.status === 'CANCELLED') {
      throw new InvalidReturnError(`Order ${order.orderNumber} is already ${order.status.toLowerCase()}`);
    }

    for (const item of order.items) {
      const returnable = item.quantity - item.returnedQuantity;
      if (returnable <= 0) continue;
      if (!item.customLabel) {
        await recordStockMovement(tx, {
          productVariantId: item.productVariantId,
          quantityDelta: returnable,
          reason: 'RETURN',
          orderId: order.id,
          actorId: input.actorId,
          note: `Order ${order.orderNumber} cancelled`,
        });
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { returnedQuantity: item.quantity } });
    }

    await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    await tx.invoice.updateMany({ where: { orderId: order.id }, data: { status: 'VOID' } });

    return { deleted: false as const, cancelled: true as const };
  });
}
