import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  costPerUnit: z.number().nonnegative().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
});

/** Owner/Admin edit an existing raw material's cost or reorder threshold — the creation form only sets these once, and costs change over time. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = updateSchema.parse(await request.json());
    const rawMaterial = await prisma.rawMaterial.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ rawMaterial });
  } catch (error) {
    return handleApiError(error);
  }
}
