import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { previewBottling } from '@/lib/services/batch';
import { handleApiError } from '@/lib/api/errors';

const previewSchema = z.object({
  productVariantId: z.string().uuid(),
  quantityProduced: z.number().int().positive(),
});

/** Bottling preview — how much bulk liquid this run needs and whether enough is already mixed. */
export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = previewSchema.parse(await request.json());
    const preview = await previewBottling(body);
    return NextResponse.json({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}
