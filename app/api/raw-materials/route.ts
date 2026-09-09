import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { listRawMaterials, createRawMaterial } from '@/lib/services/catalog';
import { recordStockMovement } from '@/lib/services/stockMovement';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const rawMaterials = await listRawMaterials();
    return NextResponse.json({ rawMaterials });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().min(1),
  costPerUnit: z.number().nonnegative(),
  lowStockThreshold: z.number().nonnegative().optional(),
  openingStock: z.number().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const rawMaterial = await createRawMaterial(body);

    if (body.openingStock && body.openingStock > 0) {
      await prisma.$transaction((tx) =>
        recordStockMovement(tx, {
          rawMaterialId: rawMaterial.id,
          quantityDelta: body.openingStock!,
          reason: 'OPENING_BALANCE',
          actorId: user.id,
        }),
      );
    }

    return NextResponse.json({ rawMaterial }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
