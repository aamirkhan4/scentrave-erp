import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { generateStaticUpiQrPng } from '@/lib/payments/staticUpiQr';
import { handleApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const amount = Number(request.nextUrl.searchParams.get('amount'));
    const note = request.nextUrl.searchParams.get('note') ?? 'Scentrave payment';
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'amount query param must be a positive number' }, { status: 400 });
    }

    const png = await generateStaticUpiQrPng(amount, note);
    return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
  } catch (error) {
    return handleApiError(error);
  }
}
