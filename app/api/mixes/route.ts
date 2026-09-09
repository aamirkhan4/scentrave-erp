import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createMixBatch } from '@/lib/services/batch';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

const createMixSchema = z.object({
  productId: z.string().uuid(),
  totalMlMixed: z.number().positive(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const mixes = await prisma.mixBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { product: true, createdBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ mixes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = createMixSchema.parse(await request.json());
    const mix = await createMixBatch({ productId: body.productId, totalMlMixed: body.totalMlMixed, createdById: user.id, notes: body.notes });
    return NextResponse.json({ mix }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
