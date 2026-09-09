import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { recordPayment } from '@/lib/services/payment';
import { round2 } from '@/lib/services/tax';
import { prisma } from '@/lib/prisma';

const markPaidSchema = z.object({
  method: z.enum(['CASH', 'UPI_DYNAMIC_QR', 'UPI_STATIC_QR', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
});

/** Manual "mark as paid" — bills settle as UNPAID by default; the owner flips this once money is actually in hand. Records one payment for whatever remains, reusing the existing payment ledger so Payments Reconciliation stays consistent. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = markPaidSchema.parse(await request.json().catch(() => ({})));

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: params.id },
      include: { order: true, payments: true },
    });

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 409 });
    }

    const alreadyPaid = invoice.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = round2(Number(invoice.order.total) - alreadyPaid);
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Nothing remaining to mark as paid' }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await recordPayment(tx, { invoiceId: invoice.id, method: body.method, amount: remaining, status: 'SUCCESS' });
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
    });

    return NextResponse.json({ invoice: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
