import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getPriceListItems, bulkUpsertPriceListItems } from '@/lib/services/priceListAdmin';
import { handleApiError } from '@/lib/api/errors';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const items = await getPriceListItems(params.id);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

const bulkSchema = z.object({
  rows: z.array(z.object({ productVariantId: z.string().uuid(), price: z.number().nonnegative() })),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = bulkSchema.parse(await request.json());
    await bulkUpsertPriceListItems(params.id, body.rows, user.id);
    const items = await getPriceListItems(params.id);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
