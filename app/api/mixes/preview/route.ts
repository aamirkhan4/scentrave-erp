import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { previewMixBatch } from '@/lib/services/batch';
import { handleApiError } from '@/lib/api/errors';

const previewSchema = z.object({
  productId: z.string().uuid(),
  totalMlMixed: z.number().positive(),
});

/** Mixing preview — what raw materials a mix of this size would consume, and whether there's enough. */
export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = previewSchema.parse(await request.json());
    const preview = await previewMixBatch(body);
    return NextResponse.json({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}
