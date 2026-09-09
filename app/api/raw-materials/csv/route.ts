import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireRole } from '@/lib/auth/session';
import { listRawMaterials } from '@/lib/services/catalog';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const rawMaterials = await listRawMaterials();
    // Explicit fields so the export is always a usable template — including
    // the header row when there's no data yet to fill in (a new business
    // starting from zero raw materials is the common case here).
    const csv = Papa.unparse({
      fields: ['Name', 'Unit', 'Category', 'Cost Per Unit', 'Low Stock Threshold', 'Stock On Hand'],
      data: rawMaterials.map((m) => [m.name, m.unit, m.category, m.costPerUnit, m.lowStockThreshold, m.stockLevel ? m.stockLevel.quantityOnHand : 0]),
    });
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="raw-materials.csv"' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Bulk import for onboarding real ingredient data: matches existing raw
 * materials by name (case-insensitive) and updates their cost/threshold/
 * stock; anything not already on file is created fresh. "Stock On Hand" is
 * always treated as the true current count (like a physical recount), not
 * an amount to add — so re-uploading the same sheet twice is harmless.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const csvText = await request.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: `CSV parse error: ${parsed.errors[0].message}` }, { status: 400 });
    }

    const existing = await prisma.rawMaterial.findMany({ where: { isActive: true } });
    const byName = new Map(existing.map((m) => [m.name.trim().toLowerCase(), m]));

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const [i, row] of parsed.data.entries()) {
      const name = row.Name?.trim();
      const unit = row.Unit?.trim();
      const category = row.Category?.trim();
      const costPerUnit = Number(row['Cost Per Unit']);
      const lowStockThreshold = row['Low Stock Threshold'] !== undefined && row['Low Stock Threshold'] !== '' ? Number(row['Low Stock Threshold']) : undefined;
      const stockOnHand = row['Stock On Hand'] !== undefined && row['Stock On Hand'] !== '' ? Number(row['Stock On Hand']) : undefined;

      if (!name || !unit || !category || Number.isNaN(costPerUnit)) {
        errors.push(`Row ${i + 2}: missing or invalid Name/Unit/Category/Cost Per Unit`);
        continue;
      }

      const key = name.toLowerCase();
      const match = byName.get(key);

      await prisma.$transaction(async (tx) => {
        let rawMaterialId: string;
        if (match) {
          await tx.rawMaterial.update({
            where: { id: match.id },
            data: { unit, category, costPerUnit, ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}) },
          });
          rawMaterialId = match.id;
        } else {
          const createdMaterial = await tx.rawMaterial.create({
            data: { name, unit, category, costPerUnit, lowStockThreshold: lowStockThreshold ?? 0 },
          });
          rawMaterialId = createdMaterial.id;
          byName.set(key, createdMaterial as (typeof existing)[number]);
        }

        if (stockOnHand !== undefined && !Number.isNaN(stockOnHand)) {
          const level = await tx.stockLevel.findFirst({ where: { rawMaterialId } });
          const currentQty = level ? Number(level.quantityOnHand) : 0;
          const delta = stockOnHand - currentQty;
          if (delta !== 0) {
            await recordStockMovement(tx, {
              rawMaterialId,
              quantityDelta: delta,
              reason: match ? 'ADJUSTMENT' : 'OPENING_BALANCE',
              actorId: user.id,
              note: `Bulk import: set to ${stockOnHand}`,
              allowNegative: true,
            });
          }
        }
      });

      if (match) updated++;
      else created++;
    }

    const rawMaterials = await listRawMaterials();
    return NextResponse.json({ rawMaterials, created, updated, errors });
  } catch (error) {
    return handleApiError(error);
  }
}
