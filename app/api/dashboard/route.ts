import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { getDashboardSummary } from '@/lib/services/dashboard';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const summary = await getDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
