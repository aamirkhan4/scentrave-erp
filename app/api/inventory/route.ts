import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { listStockLevels } from '@/lib/services/inventory';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER');
    const stock = await listStockLevels();
    return NextResponse.json({ stock });
  } catch (error) {
    return handleApiError(error);
  }
}
