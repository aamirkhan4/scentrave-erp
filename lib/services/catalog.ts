import { prisma } from '@/lib/prisma';
import type { ProductType } from '@prisma/client';

export async function listCategoriesWithSubcategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { subcategories: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } } },
  });
}

export async function createCategory(input: { name: string; slug: string; sortOrder?: number }) {
  return prisma.category.create({ data: input });
}

export async function updateCategory(id: string, input: { name?: string; slug?: string; sortOrder?: number }) {
  return prisma.category.update({ where: { id }, data: input });
}

export async function createSubcategory(input: {
  categoryId: string;
  name: string;
  slug: string;
  isRawMaterialView?: boolean;
  sortOrder?: number;
}) {
  return prisma.subcategory.create({ data: input });
}

export async function updateSubcategory(
  id: string,
  input: { name?: string; slug?: string; isRawMaterialView?: boolean; sortOrder?: number },
) {
  return prisma.subcategory.update({ where: { id }, data: input });
}

export async function listProductsForSubcategory(subcategoryId: string) {
  return prisma.product.findMany({ where: { subcategoryId }, include: { variants: true } });
}

export async function createProduct(input: {
  subcategoryId: string;
  type: ProductType;
  name: string;
  description?: string;
  fragranceFamily?: string;
}) {
  return prisma.product.create({ data: input });
}

export async function listProductsWithVariantsAndFormula() {
  return prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      subcategory: { include: { category: true } },
      variants: { orderBy: { sizeMl: 'asc' } },
      formulas: { where: { isActive: true }, include: { lines: { include: { rawMaterial: true } } } },
    },
  });
}

export async function createProductVariant(input: {
  productId: string;
  sizeMl: number;
  sizeLabel: string;
  sku: string;
  isTester?: boolean;
  costPrice?: number;
  sellingPrice: number;
  lowStockThreshold?: number;
}) {
  return prisma.productVariant.create({ data: input });
}

export async function listRawMaterials() {
  return prisma.rawMaterial.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: { stockLevel: true } });
}

export async function createRawMaterial(input: {
  name: string;
  unit: string;
  category: string;
  costPerUnit: number;
  lowStockThreshold?: number;
}) {
  return prisma.rawMaterial.create({ data: input });
}

/**
 * Replaces the active formula for a product with a new version. Formulas
 * are append-only/versioned (never mutated) so past batches stay auditable
 * against the formula that actually produced them — see Formula in the schema.
 */
export async function setActiveFormula(input: {
  productId: string;
  lines: Array<{ rawMaterialId: string; quantityPerMl: number }>;
  createdById: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const currentActive = await tx.formula.findFirst({ where: { productId: input.productId, isActive: true } });
    if (currentActive) {
      await tx.formula.update({ where: { id: currentActive.id }, data: { isActive: false } });
    }

    const nextVersion = (currentActive?.version ?? 0) + 1;
    return tx.formula.create({
      data: {
        productId: input.productId,
        version: nextVersion,
        isActive: true,
        notes: input.notes,
        createdById: input.createdById,
        lines: { create: input.lines },
      },
      include: { lines: { include: { rawMaterial: true } } },
    });
  });
}
