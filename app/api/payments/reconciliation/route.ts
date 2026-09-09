import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { getPaymentReconciliation } from '@/lib/services/paymentReconciliation';
import { handleApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const since = request.nextUrl.searchParams.get('since');
    const report = await getPaymentReconciliation(since ? new Date(since) : undefined);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
