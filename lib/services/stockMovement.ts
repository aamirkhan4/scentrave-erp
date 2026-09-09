import type { Prisma, StockMovementReason, StockableType } from '@prisma/client';
import { sendEmail } from '@/lib/notify/email';
import { sendWhatsAppMessage } from '@/lib/notify/whatsapp';

type Tx = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  constructor(
    public readonly stockableType: StockableType,
    public readonly stockableId: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Insufficient stock for ${stockableType} ${stockableId}: available ${available}, requested ${requested}`,
    );
    this.name = 'InsufficientStockError';
  }
}

interface RecordStockMovementInput {
  /** Positive quantities represent stock coming in, negative represent stock going out. */
  quantityDelta: number;
  reason: StockMovementReason;
  actorId: string;
  rawMaterialId?: string;
  productVariantId?: string;
  /** Bulk unbottled liquid (ml) for this product — mixing/bottling, not a specific bottle size. */
  productId?: string;
  batchId?: string;
  mixBatchId?: string;
  orderId?: string;
  note?: string;
  /**
   * Allow the resulting on-hand quantity to go negative. Only intended for
   * ADJUSTMENT entries that reconcile a physical count discovery — never for
   * SALE or PRODUCTION_CONSUME, which must always be stock-backed.
   */
  allowNegative?: boolean;
}

/**
 * The single write path for every stock-affecting action in the system.
 * Every sale, return, production batch, purchase, and manual adjustment MUST
 * go through this function so the StockMovement ledger stays complete and
 * StockLevel stays consistent with it. Never write to StockLevel directly
 * from anywhere else.
 *
 * Must be called inside an existing `prisma.$transaction` so the movement,
 * the level update, and whatever business record triggered it (Order,
 * Batch, ...) commit or roll back together.
 */
export async function recordStockMovement(tx: Tx, input: RecordStockMovementInput) {
  const {
    quantityDelta,
    reason,
    actorId,
    rawMaterialId,
    productVariantId,
    productId,
    batchId,
    mixBatchId,
    orderId,
    note,
    allowNegative = false,
  } = input;

  if (quantityDelta === 0) {
    throw new Error('quantityDelta must be non-zero');
  }
  const keyCount = [rawMaterialId, productVariantId, productId].filter(Boolean).length;
  if (keyCount === 0) {
    throw new Error('One of rawMaterialId, productVariantId, or productId must be provided');
  }
  if (keyCount > 1) {
    throw new Error('Provide only one of rawMaterialId, productVariantId, or productId, not multiple');
  }

  const stockableType: StockableType = rawMaterialId ? 'RAW_MATERIAL' : productVariantId ? 'PRODUCT_VARIANT' : 'BULK_LIQUID';
  const stockableId = rawMaterialId ?? productVariantId ?? productId!;

  const levelWhere = rawMaterialId ? { rawMaterialId } : productVariantId ? { productVariantId } : { productId: productId! };

  const existingLevel = await tx.stockLevel.findFirst({ where: levelWhere });
  const currentQty = existingLevel ? Number(existingLevel.quantityOnHand) : 0;
  const nextQty = currentQty + quantityDelta;

  if (nextQty < 0 && !allowNegative) {
    throw new InsufficientStockError(stockableType, stockableId, currentQty, -quantityDelta);
  }

  const movement = await tx.stockMovement.create({
    data: {
      stockableType,
      rawMaterialId,
      productVariantId,
      productId,
      quantityDelta,
      reason,
      batchId,
      mixBatchId,
      orderId,
      actorId,
      note,
    },
  });

  if (existingLevel) {
    await tx.stockLevel.update({
      where: { id: existingLevel.id },
      data: { quantityOnHand: nextQty },
    });
  } else {
    await tx.stockLevel.create({
      data: {
        rawMaterialId,
        productVariantId,
        productId,
        quantityOnHand: nextQty,
      },
    });
  }

  if (stockableType !== 'BULK_LIQUID') {
    await notifyIfCrossedLowStock(tx, { stockableType, rawMaterialId, productVariantId, currentQty, nextQty });
  }

  return movement;
}

/**
 * Edge-triggered: fires only on the transition from above-threshold to
 * at-or-below-threshold, so a SKU sitting low doesn't spam a notification on
 * every subsequent sale. Recipients are every active OWNER/ADMIN user.
 */
async function notifyIfCrossedLowStock(
  tx: Tx,
  args: {
    stockableType: StockableType;
    rawMaterialId?: string;
    productVariantId?: string;
    currentQty: number;
    nextQty: number;
  },
) {
  const { stockableType, rawMaterialId, productVariantId, currentQty, nextQty } = args;

  const threshold =
    stockableType === 'RAW_MATERIAL'
      ? Number((await tx.rawMaterial.findUniqueOrThrow({ where: { id: rawMaterialId! } })).lowStockThreshold)
      : (await tx.productVariant.findUniqueOrThrow({ where: { id: productVariantId! } })).lowStockThreshold;

  const justCrossed = currentQty > threshold && nextQty <= threshold;
  if (!justCrossed) return;

  const itemName =
    stockableType === 'RAW_MATERIAL'
      ? (await tx.rawMaterial.findUniqueOrThrow({ where: { id: rawMaterialId! } })).name
      : (await tx.productVariant.findUniqueOrThrow({ where: { id: productVariantId! }, include: { product: true } })).sku;

  const recipients = await tx.user.findMany({ where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true } });
  if (recipients.length === 0) return;

  const notification = await tx.notification.create({
    data: {
      type: 'LOW_STOCK',
      title: `Low stock: ${itemName}`,
      body: `${itemName} is at ${nextQty}, at or below the threshold of ${threshold}.`,
      metadata: { stockableType, rawMaterialId, productVariantId, quantityOnHand: nextQty, threshold },
    },
  });

  await tx.notificationRecipient.createMany({
    data: recipients.map((r) => ({ notificationId: notification.id, userId: r.id })),
  });

  // Fire-and-forget: deliberately not awaited so a slow/failed email or
  // WhatsApp call can never hold open (or roll back) the stock transaction.
  // The Notification row above is the durable record; this is best-effort.
  for (const recipient of recipients) {
    void sendEmail({ to: recipient.email, subject: notification.title, body: notification.body }).catch(() => {});
    if (recipient.phone) {
      void sendWhatsAppMessage({ to: recipient.phone, body: `${notification.title}\n${notification.body}` }).catch(() => {});
    }
  }
}

export async function getStockOnHand(
  tx: Tx,
  target: { rawMaterialId: string } | { productVariantId: string },
): Promise<number> {
  const level = await tx.stockLevel.findFirst({ where: target });
  return level ? Number(level.quantityOnHand) : 0;
}
