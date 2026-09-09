import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { listPriceLists, createPriceList } from '@/lib/services/priceListAdmin';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const priceLists = await listPriceLists();
    return NextResponse.json({ priceLists });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({ name: z.string().min(1), isDefault: z.boolean().optional() });

export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const priceList = await createPriceList(body);
    return NextResponse.json({ priceList }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
