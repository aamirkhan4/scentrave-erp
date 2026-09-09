import Razorpay from 'razorpay';
import crypto from 'crypto';

let client: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (client) return client;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
  }
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/**
 * Creates a single-use dynamic UPI QR for the exact invoice amount via
 * Razorpay's QR Code API. Amount is in paise. Returns the QR image URL and
 * the Razorpay QR id, which we store as Payment.razorpayOrderId so the
 * webhook can match the credit back to this payment leg.
 */
export async function createDynamicQr(input: { amountRupees: number; invoiceNumber: string; closeByMinutes?: number }) {
  const razorpay = getRazorpayClient();
  const closeBy = Math.floor(Date.now() / 1000) + (input.closeByMinutes ?? 15) * 60;

  const qr = await razorpay.qrCode.create({
    type: 'upi_qr',
    name: `Scentrave — ${input.invoiceNumber}`,
    usage: 'single_use',
    fixed_amount: true,
    payment_amount: Math.round(input.amountRupees * 100),
    description: input.invoiceNumber,
    close_by: closeBy,
  });

  return { qrId: qr.id, imageUrl: qr.image_url, closeBy };
}

export function verifyRazorpayWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
