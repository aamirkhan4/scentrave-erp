import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import { recomputeInvoiceStatus } from '@/lib/services/payment';
import { prisma } from '@/lib/prisma';

/**
 * Razorpay webhook — no session/role gate (Razorpay calls this directly),
 * authenticated instead by the HMAC signature in x-razorpay-signature.
 * Handles `qr_code.credited`: matches the credited QR back to the Payment
 * row created in /api/payments/dynamic-qr via razorpayOrderId, marks it
 * SUCCESS, and recomputes the invoice's paid status.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'qr_code.credited') {
    const qrId: string | undefined = event.payload?.qr_code?.entity?.id;
    const razorpayPaymentId: string | undefined = event.payload?.payment?.entity?.id;

    if (qrId) {
      const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: qrId } });
      if (payment && payment.status === 'PENDING') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'SUCCESS', razorpayPaymentId, paidAt: new Date(), webhookPayload: event },
          });
          await recomputeInvoiceStatus(tx, payment.invoiceId);
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
