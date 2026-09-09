import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { processReturn } from '@/lib/services/returns';
import { handleApiError } from '@/lib/api/errors';

const returnSchema = z.object({
  lines: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  note: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER');
    const body = returnSchema.parse(await request.json());
    const order = await processReturn({ orderId: params.id, lines: body.lines, actorId: user.id, note: body.note });
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
