import QRCode from 'qrcode';
import { getShopSettings } from '@/lib/services/shopSettings';

/** Builds a standard UPI deep-link URI for a fixed amount, then renders it as a PNG QR code. */
export async function generateStaticUpiQrPng(amountRupees: number, transactionNote: string): Promise<Buffer> {
  const settings = await getShopSettings();
  const vpa = settings.upiVpa;
  const payeeName = settings.upiPayeeName ?? settings.shopName;
  if (!vpa) throw new Error('UPI VPA is not configured — set it under Settings → Shop Details');

  const uri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amountRupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  return QRCode.toBuffer(uri, { type: 'png', width: 300, margin: 1 });
}
