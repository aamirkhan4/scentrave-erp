import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createDynamicQr } from '@/lib/payments/razorpay';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const schema = z.object({ invoiceId: z.string().uuid(), amountRupees: z.number().positive() });

/** Creates a Razorpay dynamic QR for one payment leg and records it PENDING; the webhook flips it to SUCCESS on credit. */
export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const body = schema.parse(await request.json());

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: body.invoiceId } });
    const qr = await createDynamicQr({ amountRupees: body.amountRupees, invoiceNumber: invoice.invoiceNumber });

    const payment = await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        method: 'UPI_DYNAMIC_QR',
        amount: body.amountRupees,
        status: 'PENDING',
        razorpayOrderId: qr.qrId,
      },
    });

    return NextResponse.json({ payment, qrImageUrl: qr.imageUrl, closeBy: qr.closeBy });
  } catch (error) {
    return handleApiError(error);
  }
}
