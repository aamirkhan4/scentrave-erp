
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementReason" ADD VALUE 'MIX_IN';
ALTER TYPE "StockMovementReason" ADD VALUE 'BOTTLING_CONSUME';

-- AlterEnum
ALTER TYPE "StockableType" ADD VALUE 'BULK_LIQUID';

-- AlterTable
ALTER TABLE "stock_levels" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "mixBatchId" TEXT,
ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "mix_batches" (
    "id" TEXT NOT NULL,
    "mixNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "formulaId" TEXT,
    "totalMlMixed" DECIMAL(10,2) NOT NULL,
    "mixDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mix_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mix_batches_mixNumber_key" ON "mix_batches"("mixNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_productId_key" ON "stock_levels"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- AddForeignKey
ALTER TABLE "mix_batches" ADD CONSTRAINT "mix_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mix_batches" ADD CONSTRAINT "mix_batches_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mix_batches" ADD CONSTRAINT "mix_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_mixBatchId_fkey" FOREIGN KEY ("mixBatchId") REFERENCES "mix_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

