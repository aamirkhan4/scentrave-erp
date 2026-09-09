import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SalesReportRow } from '@/lib/services/reports';

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 16;
const PAGE_WIDTH = 842; // A4 landscape, points
const PAGE_HEIGHT = 595;

const COLUMNS = [
  { key: 'date', label: 'Date', width: 60 },
  { key: 'orderNumber', label: 'Order ID', width: 75 },
  { key: 'productName', label: 'Perfume', width: 130 },
  { key: 'customerName', label: 'Customer', width: 95 },
  { key: 'state', label: 'State', width: 75 },
  { key: 'quantity', label: 'Qty', width: 35 },
  { key: 'bankDetails', label: 'Bank Details (UPI)', width: 100 },
  { key: 'taxableAmount', label: 'Taxable Rs.', width: 60 },
  { key: 'cgst', label: 'CGST Rs.', width: 45 },
  { key: 'sgst', label: 'SGST Rs.', width: 45 },
  { key: 'igst', label: 'IGST Rs.', width: 45 },
  { key: 'totalAmount', label: 'Total Rs.', width: 60 },
] as const;

export async function generateSalesReportPdf(rows: SalesReportRow[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - PAGE_MARGIN;

  page.drawText('SCENTRAVE', { x: PAGE_MARGIN, y, size: 18, font: bold, color: rgb(0.13, 0.1, 0.08) });
  y -= 22;
  page.drawText(title, { x: PAGE_MARGIN, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 24;

  function drawHeader() {
    let x = PAGE_MARGIN;
    for (const col of COLUMNS) {
      page.drawText(col.label, { x, y, size: 8, font: bold });
      x += col.width;
    }
    y -= ROW_HEIGHT;
    page.drawLine({ start: { x: PAGE_MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - PAGE_MARGIN, y: y + 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }

  drawHeader();

  let totalQty = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalAmount = 0;

  for (const row of rows) {
    if (y < PAGE_MARGIN + ROW_HEIGHT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - PAGE_MARGIN;
      drawHeader();
    }

    let x = PAGE_MARGIN;
    const values: Record<string, string> = {
      date: new Date(row.date).toLocaleDateString('en-IN'),
      orderNumber: row.orderNumber,
      productName: row.productName,
      customerName: row.customerName,
      state: row.state,
      quantity: String(row.quantity),
      bankDetails: row.bankDetails ?? '—',
      taxableAmount: row.taxableAmount.toFixed(2),
      cgst: row.isIgst ? '—' : row.cgst.toFixed(2),
      sgst: row.isIgst ? '—' : row.sgst.toFixed(2),
      igst: row.isIgst ? row.igst.toFixed(2) : '—',
      totalAmount: row.totalAmount.toFixed(2),
    };
    for (const col of COLUMNS) {
      const text = values[col.key];
      // Truncate long text so it doesn't spill into the next column.
      const maxChars = Math.floor(col.width / 4.5);
      page.drawText(text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text, { x, y, size: 7.5, font });
      x += col.width;
    }
    y -= ROW_HEIGHT;

    totalQty += row.quantity;
    totalTaxable += row.taxableAmount;
    totalCgst += row.cgst;
    totalSgst += row.sgst;
    totalIgst += row.igst;
    totalAmount += row.totalAmount;
  }

  y -= 6;
  page.drawLine({ start: { x: PAGE_MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - PAGE_MARGIN, y: y + 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 14;

  let x = PAGE_MARGIN;
  const totals: Record<string, string> = {
    date: '',
    orderNumber: '',
    productName: '',
    customerName: '',
    state: '',
    quantity: String(totalQty),
    bankDetails: 'TOTAL',
    taxableAmount: totalTaxable.toFixed(2),
    cgst: totalCgst.toFixed(2),
    sgst: totalSgst.toFixed(2),
    igst: totalIgst.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
  for (const col of COLUMNS) {
    page.drawText(totals[col.key], { x, y, size: 8, font: bold });
    x += col.width;
  }

  return doc.save();
}
