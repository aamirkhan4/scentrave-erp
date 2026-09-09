import { PrismaClient } from '@prisma/client';
import { createBottlingBatch } from '../lib/services/batch';
import { recordStockMovement } from '../lib/services/stockMovement';

const prisma = new PrismaClient();

/** RawMaterial/Product have no unique name column; find-or-create by name for idempotent seeding. */
async function findOrCreateByName<T extends { findFirst: Function; create: Function }>(
  model: T,
  name: string,
  createData: Record<string, unknown>,
): Promise<any> {
  const existing = await (model as any).findFirst({ where: { name } });
  if (existing) return existing;
  return (model as any).create({ data: createData });
}

async function main() {
  console.log('Seeding Scentrave demo data...');

  // ── Users ────────────────────────────────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: 'owner@scentrave.test' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000001',
      name: 'Aisha Khan',
      email: 'owner@scentrave.test',
      phone: '+919800000001',
      role: 'OWNER',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@scentrave.test' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000002',
      name: 'Rohan Mehta',
      email: 'admin@scentrave.test',
      phone: '+919800000002',
      role: 'ADMIN',
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@scentrave.test' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000003',
      name: 'Priya Nair',
      email: 'cashier@scentrave.test',
      phone: '+919800000003',
      role: 'CASHIER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'sales@scentrave.test' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000004',
      name: 'Farhan Ali',
      email: 'sales@scentrave.test',
      phone: '+919800000004',
      role: 'SALES_AGENT',
    },
  });

  // ── Categories / Subcategories ──────────────────────────────────────
  const perfumeCategory = await prisma.category.upsert({
    where: { slug: 'perfume' },
    update: {},
    create: { name: 'Perfume', slug: 'perfume', sortOrder: 1 },
  });

  const oilCategory = await prisma.category.upsert({
    where: { slug: 'oil' },
    update: {},
    create: { name: 'Oil', slug: 'oil', sortOrder: 2 },
  });

  const solventSubcat = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: perfumeCategory.id, slug: 'solvent' } },
    update: {},
    create: {
      categoryId: perfumeCategory.id,
      name: 'Solvent',
      slug: 'solvent',
      isRawMaterialView: true,
      sortOrder: 1,
    },
  });

  const perfumesSubcat = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: perfumeCategory.id, slug: 'perfumes' } },
    update: {},
    create: { categoryId: perfumeCategory.id, name: 'Perfumes', slug: 'perfumes', sortOrder: 2 },
  });

  const oilsSubcat = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: oilCategory.id, slug: 'oils' } },
    update: {},
    create: { categoryId: oilCategory.id, name: 'Oils', slug: 'oils', sortOrder: 1 },
  });
  void solventSubcat; // reserved for the admin raw-material subview UI

  // ── Raw materials ────────────────────────────────────────────────────
  const rawMaterialDefs = [
    { name: 'Ethanol', unit: 'ml', category: 'Solvent', costPerUnit: 0.9, lowStockThreshold: 5000 },
    { name: 'DPG (Dipropylene Glycol)', unit: 'ml', category: 'Solvent', costPerUnit: 0.6, lowStockThreshold: 3000 },
    { name: 'Oud Concentrate', unit: 'ml', category: 'Concentrate', costPerUnit: 45, lowStockThreshold: 500 },
    { name: 'Rose Attar Concentrate', unit: 'ml', category: 'Concentrate', costPerUnit: 30, lowStockThreshold: 500 },
    { name: 'Musk Fixative', unit: 'ml', category: 'Concentrate', costPerUnit: 20, lowStockThreshold: 300 },
    { name: '50ml Bottle', unit: 'unit', category: 'Packaging', costPerUnit: 12, lowStockThreshold: 100 },
    { name: '25ml Bottle', unit: 'unit', category: 'Packaging', costPerUnit: 8, lowStockThreshold: 100 },
    { name: '10ml Tester Vial', unit: 'unit', category: 'Packaging', costPerUnit: 4, lowStockThreshold: 100 },
    { name: '3ml Tester Vial', unit: 'unit', category: 'Packaging', costPerUnit: 2, lowStockThreshold: 100 },
  ];

  const rawMaterials: Record<string, Awaited<ReturnType<typeof prisma.rawMaterial.findFirstOrThrow>>> = {};
  for (const def of rawMaterialDefs) {
    rawMaterials[def.name] = await findOrCreateByName(prisma.rawMaterial, def.name, def);
  }

  // ── Opening stock for raw materials ─────────────────────────────────
  for (const material of Object.values(rawMaterials)) {
    const existingLevel = await prisma.stockLevel.findFirst({ where: { rawMaterialId: material.id } });
    if (!existingLevel) {
      await prisma.$transaction((tx) =>
        recordStockMovement(tx, {
          rawMaterialId: material.id,
          quantityDelta: 10000,
          reason: 'OPENING_BALANCE',
          actorId: owner.id,
          note: 'Initial seed stock',
        }),
      );
    }
  }

  // ── Product: Oud Rose (Perfume, alcohol-based) ──────────────────────
  const oudRose = await findOrCreateByName(prisma.product, 'Oud Rose', {
    subcategoryId: perfumesSubcat.id,
    type: 'PERFUME',
    name: 'Oud Rose',
    description: 'A warm oud and rose blend with a musk base.',
    fragranceFamily: 'Woody',
  });

  const oudRoseFormula = await prisma.formula.upsert({
    where: { productId_version: { productId: oudRose.id, version: 1 } },
    update: {},
    create: {
      productId: oudRose.id,
      version: 1,
      isActive: true,
      notes: '18% attar / 2% fixative / 80% solvent per ml',
      createdById: owner.id,
      lines: {
        create: [
          { rawMaterialId: rawMaterials['Oud Concentrate'].id, quantityPerMl: 0.12 },
          { rawMaterialId: rawMaterials['Rose Attar Concentrate'].id, quantityPerMl: 0.06 },
          { rawMaterialId: rawMaterials['Musk Fixative'].id, quantityPerMl: 0.02 },
          { rawMaterialId: rawMaterials['Ethanol'].id, quantityPerMl: 0.8 },
        ],
      },
    },
  });

  const oudRoseVariantDefs = [
    { sizeMl: 3, sizeLabel: '3ml Tester', sku: 'OUDR-3T', isTester: true, costPrice: 15, sellingPrice: 0 },
    { sizeMl: 10, sizeLabel: '10ml Tester', sku: 'OUDR-10T', isTester: true, costPrice: 42, sellingPrice: 199 },
    { sizeMl: 25, sizeLabel: '25ml', sku: 'OUDR-25', isTester: false, costPrice: 95, sellingPrice: 1499 },
    { sizeMl: 50, sizeLabel: '50ml', sku: 'OUDR-50', isTester: false, costPrice: 175, sellingPrice: 2699 },
  ];

  const oudRoseVariants = [];
  for (const def of oudRoseVariantDefs) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: def.sku },
      update: {},
      create: { productId: oudRose.id, ...def },
    });
    oudRoseVariants.push(variant);
  }

  // ── Product: Amber Musk Attar (Oil, no solvent formula) ─────────────
  const amberMusk = await findOrCreateByName(prisma.product, 'Amber Musk Attar', {
    subcategoryId: oilsSubcat.id,
    type: 'OIL',
    name: 'Amber Musk Attar',
    description: 'Pure oil-based amber and musk attar, alcohol-free.',
    fragranceFamily: 'Amber',
  });

  const amberMuskVariantDefs = [
    { sizeMl: 2, sizeLabel: '2ml', sku: 'AMBM-2', isTester: false, costPrice: 25, sellingPrice: 349 },
    { sizeMl: 3, sizeLabel: '3ml', sku: 'AMBM-3', isTester: false, costPrice: 35, sellingPrice: 499 },
    { sizeMl: 6, sizeLabel: '6ml', sku: 'AMBM-6', isTester: false, costPrice: 65, sellingPrice: 899 },
    { sizeMl: 10, sizeLabel: '10ml', sku: 'AMBM-10', isTester: false, costPrice: 105, sellingPrice: 1399 },
  ];

  for (const def of amberMuskVariantDefs) {
    await prisma.productVariant.upsert({
      where: { sku: def.sku },
      update: {},
      create: { productId: amberMusk.id, ...def },
    });
  }
  // Opening stock for the attar (no formula — bottled directly from concentrate purchase)
  const amberMusk2ml = await prisma.productVariant.findUniqueOrThrow({ where: { sku: 'AMBM-2' } });
  const existingAmberLevel = await prisma.stockLevel.findFirst({ where: { productVariantId: amberMusk2ml.id } });
  if (!existingAmberLevel) {
    await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        productVariantId: amberMusk2ml.id,
        quantityDelta: 40,
        reason: 'OPENING_BALANCE',
        actorId: owner.id,
        note: 'Initial seed stock',
      }),
    );
  }

  // ── Price lists ──────────────────────────────────────────────────────
  const retailList = await prisma.priceList.upsert({
    where: { name: 'Retail' },
    update: {},
    create: { name: 'Retail', isDefault: true },
  });
  await prisma.priceList.upsert({
    where: { name: 'Wholesale' },
    update: {},
    create: { name: 'Wholesale' },
  });

  for (const variant of oudRoseVariants) {
    await prisma.priceListItem.upsert({
      where: { priceListId_productVariantId: { priceListId: retailList.id, productVariantId: variant.id } },
      update: {},
      create: { priceListId: retailList.id, productVariantId: variant.id, price: variant.sellingPrice },
    });
  }

  // ── Customers ────────────────────────────────────────────────────────
  await prisma.customer.upsert({
    where: { phone: '+919811111111' },
    update: {},
    create: {
      name: 'Meera Kapoor',
      phone: '+919811111111',
      email: 'meera@example.com',
      state: 'Maharashtra',
      priceListId: retailList.id,
      loyaltyTier: 'GOLD',
      loyaltyPoints: 420,
      preferredCategory: 'Perfume',
    },
  });

  await prisma.customer.upsert({
    where: { phone: '+919822222222' },
    update: {},
    create: {
      name: 'Vikram Singh',
      phone: '+919822222222',
      email: 'vikram@example.com',
      state: 'Maharashtra',
      priceListId: retailList.id,
      loyaltyTier: 'SILVER',
      loyaltyPoints: 90,
      preferredCategory: 'Oil',
    },
  });

  // ── Sample production batch, run through the real service ───────────
  const existingBatch = await prisma.batch.findFirst({ where: { productVariantId: oudRoseVariants[2].id } });
  if (!existingBatch) {
    const batch = await createBottlingBatch({
      productVariantId: oudRoseVariants[2].id, // 25ml
      quantityProduced: 20,
      createdById: admin.id,
      notes: 'Seed demo batch',
    });
    console.log(`Created demo batch ${batch.batchNumber}: ${batch.quantityProduced} x ${batch.productVariant.sizeLabel} ${batch.productVariant.product.name}`);
  }

  // ── Discounts ────────────────────────────────────────────────────────
  await prisma.discount.upsert({
    where: { code: 'FESTIVE10' },
    update: {},
    create: {
      code: 'FESTIVE10',
      name: 'Festive Season 10% Off',
      type: 'PERCENTAGE',
      scope: 'ORDER',
      value: 10,
      usageLimit: 500,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Seed complete. Owner=${owner.email} Admin=${admin.email} Cashier=${cashier.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
