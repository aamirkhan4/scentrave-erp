import { prisma } from '@/lib/prisma';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { currentFinancialYear, nextSequenceNumber, formatSequencedNumber } from '@/lib/services/sequence';

interface RawMaterialConsumption {
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  quantityPerMl: number;
  quantityConsumed: number;
  availableBeforeConsumption: number;
  sufficientStock: boolean;
}

export interface MixPreview {
  productId: string;
  productName: string;
  totalMlMixed: number;
  formulaId: string | null;
  formulaVersion: number | null;
  consumption: RawMaterialConsumption[];
  canProceed: boolean;
}

/**
 * Production happens in two stages, matching how a perfume is actually
 * made: raw materials are mixed once into a bulk liquid (tracked in ml,
 * against the *product*, not any one size), then that same liquid is
 * bottled into however many 10ml/25ml/50ml units are needed. The sizes
 * are just packaging of one pool — never separate products, never
 * separate raw-material consumption.
 *
 * Stage 1 — mixing: computes what a mix would consume, without writing
 * anything. Backs the "Mix a batch" preview.
 */
export async function previewMixBatch(input: { productId: string; totalMlMixed: number }): Promise<MixPreview> {
  const { productId, totalMlMixed } = input;
  if (totalMlMixed <= 0) throw new Error('totalMlMixed must be positive');

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { formulas: { where: { isActive: true }, include: { lines: { include: { rawMaterial: true } } } } },
  });

  const activeFormula = product.formulas[0] ?? null;
  const consumption: RawMaterialConsumption[] = [];
  if (activeFormula) {
    for (const line of activeFormula.lines) {
      const quantityConsumed = Number(line.quantityPerMl) * totalMlMixed;
      const level = await prisma.stockLevel.findFirst({ where: { rawMaterialId: line.rawMaterialId } });
      const availableBeforeConsumption = level ? Number(level.quantityOnHand) : 0;
      consumption.push({
        rawMaterialId: line.rawMaterialId,
        rawMaterialName: line.rawMaterial.name,
        unit: line.rawMaterial.unit,
        quantityPerMl: Number(line.quantityPerMl),
        quantityConsumed,
        availableBeforeConsumption,
        sufficientStock: availableBeforeConsumption >= quantityConsumed,
      });
    }
  }

  return {
    productId,
    productName: product.name,
    totalMlMixed,
    formulaId: activeFormula?.id ?? null,
    formulaVersion: activeFormula?.version ?? null,
    consumption,
    canProceed: consumption.every((c) => c.sufficientStock),
  };
}

/** Stage 1 — confirms the mix: deducts raw materials per the formula and adds bulk liquid (ml) stock for the product. */
export async function createMixBatch(input: { productId: string; totalMlMixed: number; createdById: string; notes?: string }) {
  const { productId, totalMlMixed, createdById, notes } = input;

  const preview = await previewMixBatch({ productId, totalMlMixed });
  if (preview.consumption.length === 0) {
    throw new Error('This product has no active formula — nothing to mix. Add a formula first, or bottle it directly if it needs no mixing.');
  }
  if (!preview.canProceed) {
    const shortfalls = preview.consumption
      .filter((c) => !c.sufficientStock)
      .map((c) => `${c.rawMaterialName}: need ${c.quantityConsumed}${c.unit}, have ${c.availableBeforeConsumption}${c.unit}`)
      .join('; ');
    throw new Error(`Cannot proceed: insufficient raw material stock — ${shortfalls}`);
  }

  return prisma.$transaction(async (tx) => {
    const financialYear = currentFinancialYear();
    const sequence = await nextSequenceNumber(tx, 'mix', financialYear);
    const mixNumber = formatSequencedNumber('MIX', financialYear, sequence);

    const mixBatch = await tx.mixBatch.create({
      data: { mixNumber, productId, formulaId: preview.formulaId, totalMlMixed, createdById, notes },
    });

    for (const line of preview.consumption) {
      await recordStockMovement(tx, {
        rawMaterialId: line.rawMaterialId,
        quantityDelta: -line.quantityConsumed,
        reason: 'PRODUCTION_CONSUME',
        mixBatchId: mixBatch.id,
        actorId: createdById,
        note: `Consumed for mix ${mixNumber}`,
      });
    }

    await recordStockMovement(tx, {
      productId,
      quantityDelta: totalMlMixed,
      reason: 'MIX_IN',
      mixBatchId: mixBatch.id,
      actorId: createdById,
      note: `Mixed ${totalMlMixed}ml — ${mixNumber}`,
    });

    return tx.mixBatch.findUniqueOrThrow({
      where: { id: mixBatch.id },
      include: { product: true, formula: { include: { lines: { include: { rawMaterial: true } } } }, stockMovements: true },
    });
  });
}

export interface BottlingPreview {
  productVariantId: string;
  productName: string;
  sizeLabel: string;
  quantityProduced: number;
  totalMlNeeded: number;
  hasFormula: boolean;
  bulkMlAvailable: number;
  canProceed: boolean;
}

/** Stage 2 — previews bottling: how much bulk liquid a run of bottles needs, and whether there's enough mixed already. */
export async function previewBottling(input: { productVariantId: string; quantityProduced: number }): Promise<BottlingPreview> {
  const { productVariantId, quantityProduced } = input;
  if (quantityProduced <= 0) throw new Error('quantityProduced must be positive');

  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { id: productVariantId },
    include: { product: { include: { formulas: { where: { isActive: true }, select: { id: true } } } } },
  });

  const totalMlNeeded = Number(variant.sizeMl) * quantityProduced;
  const hasFormula = variant.product.formulas.length > 0;

  // Products with no formula (e.g. oils bottled directly) skip the bulk-stock
  // check entirely, same as before this two-stage model existed.
  if (!hasFormula) {
    return { productVariantId, productName: variant.product.name, sizeLabel: variant.sizeLabel, quantityProduced, totalMlNeeded, hasFormula, bulkMlAvailable: 0, canProceed: true };
  }

  const bulkLevel = await prisma.stockLevel.findFirst({ where: { productId: variant.product.id } });
  const bulkMlAvailable = bulkLevel ? Number(bulkLevel.quantityOnHand) : 0;

  return {
    productVariantId,
    productName: variant.product.name,
    sizeLabel: variant.sizeLabel,
    quantityProduced,
    totalMlNeeded,
    hasFormula,
    bulkMlAvailable,
    canProceed: bulkMlAvailable >= totalMlNeeded,
  };
}

/** Stage 2 — confirms bottling: deducts bulk liquid (if the product has a formula) and adds bottle-count stock to the specific size. */
export async function createBottlingBatch(input: {
  productVariantId: string;
  quantityProduced: number;
  createdById: string;
  expiryDate?: Date;
  notes?: string;
}) {
  const { productVariantId, quantityProduced, createdById, expiryDate, notes } = input;

  const preview = await previewBottling({ productVariantId, quantityProduced });
  if (!preview.canProceed) {
    throw new Error(
      `Cannot proceed: need ${preview.totalMlNeeded}ml of ${preview.productName} but only ${preview.bulkMlAvailable}ml is mixed. Mix a batch first.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: productVariantId },
      include: { product: { include: { formulas: { where: { isActive: true } } } } },
    });
    const activeFormula = variant.product.formulas[0] ?? null;

    const financialYear = currentFinancialYear();
    const sequence = await nextSequenceNumber(tx, 'batch', financialYear);
    const batchNumber = formatSequencedNumber('BATCH', financialYear, sequence);

    const batch = await tx.batch.create({
      data: {
        batchNumber,
        productVariantId,
        formulaId: activeFormula?.id ?? null,
        quantityProduced,
        totalMlProduced: preview.totalMlNeeded,
        expiryDate,
        createdById,
        notes,
      },
    });

    if (preview.hasFormula) {
      await recordStockMovement(tx, {
        productId: variant.productId,
        quantityDelta: -preview.totalMlNeeded,
        reason: 'BOTTLING_CONSUME',
        batchId: batch.id,
        actorId: createdById,
        note: `Bottled into ${batchNumber}`,
      });
    }

    await recordStockMovement(tx, {
      productVariantId,
      quantityDelta: quantityProduced,
      reason: 'PRODUCTION_IN',
      batchId: batch.id,
      actorId: createdById,
      note: `Bottled by ${batchNumber}`,
    });

    return tx.batch.findUniqueOrThrow({
      where: { id: batch.id },
      include: { productVariant: { include: { product: true } }, formula: { include: { lines: { include: { rawMaterial: true } } } }, stockMovements: true },
    });
  });
}
