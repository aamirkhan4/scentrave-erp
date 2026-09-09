import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireRole } from '@/lib/auth/session';
import { getSalesTransactionReport, salesReportToCsvRows, type PaymentModeFilter } from '@/lib/services/reports';
import { generateSalesReportPdf } from '@/lib/pdf/salesReport';
import { handleApiError } from '@/lib/api/errors';

const VALID_PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'] as const;

export async function GET(request: NextRequest) {
  try {
    // Full transaction-level detail (customer name, order id) is Owner/Admin-only, same visibility rule as cost/margin data elsewhere.
    await requireRole('OWNER', 'ADMIN');

    const params = request.nextUrl.searchParams;
    const format = params.get('format') ?? 'json';
    const startDate = params.get('startDate') ? new Date(params.get('startDate')!) : undefined;
    const endDate = params.get('endDate') ? new Date(params.get('endDate')!) : undefined;
    const paymentModeParam = params.get('paymentMode');
    const paymentMode = VALID_PAYMENT_MODES.find((m) => m === paymentModeParam) as PaymentModeFilter | undefined;

    const rows = await getSalesTransactionReport({
      startDate,
      endDate,
      state: params.get('state') ?? undefined,
      paymentMode,
    });

    if (format === 'csv') {
      const csv = Papa.unparse(salesReportToCsvRows(rows));
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="scentrave-sales-report.csv"',
        },
      });
    }

    if (format === 'pdf') {
      const pdfBytes = await generateSalesReportPdf(rows, 'Sales Transactions Report');
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="scentrave-sales-report.pdf"',
        },
      });
    }

    return NextResponse.json({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
