import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { buildInvoiceWhatsAppShare } from '@/lib/services/invoiceDelivery';
import { handleApiError } from '@/lib/api/errors';

/** Uploads (or reuses) the invoice PDF and returns a WhatsApp share link prefilled with it. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const share = await buildInvoiceWhatsAppShare(params.id);
    return NextResponse.json(share);
  } catch (error) {
    return handleApiError(error);
  }
}
