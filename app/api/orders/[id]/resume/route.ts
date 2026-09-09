import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { resumeHeldOrder } from '@/lib/services/order';
import { handleApiError } from '@/lib/api/errors';

const resumeSchema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'UPI_DYNAMIC_QR', 'UPI_STATIC_QR', 'CARD', 'BANK_TRANSFER', 'LOYALTY_POINTS', 'OTHER']),
        amount: z.number().positive(),
      }),
    )
    .default([]),
  redeemPoints: z.number().int().positive().optional(),
});

/** Resumes a parked/held bill: deducts stock, creates the invoice, and records payments. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const body = resumeSchema.parse(await request.json());
    const result = await resumeHeldOrder(params.id, user.id, body.payments, body.redeemPoints);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
