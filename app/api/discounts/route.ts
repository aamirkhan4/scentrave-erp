import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const discounts = await prisma.discount.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ discounts });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1).optional(),
    type: z.enum(['FLAT', 'PERCENTAGE', 'BUY_X_GET_Y']),
    scope: z.enum(['ORDER', 'CATEGORY', 'PRODUCT']).default('ORDER'),
    value: z.number().nonnegative().optional(),
    buyQuantity: z.number().int().positive().optional(),
    getQuantity: z.number().int().positive().optional(),
    categoryId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    usageLimit: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((v) => v.type !== 'BUY_X_GET_Y' || (v.buyQuantity && v.getQuantity && v.scope !== 'ORDER'), {
    message: 'BUY_X_GET_Y requires buyQuantity, getQuantity, and a PRODUCT or CATEGORY scope',
  });

export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const discount = await prisma.discount.create({
      data: { ...body, expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined },
    });
    return NextResponse.json({ discount }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
