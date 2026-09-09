import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';
import path from 'path';
import { computeTaxBreakup } from '@/lib/services/tax';

export interface InvoicePdfData {
  shopName: string;
  shopAddress?: string | null;
  shopEmail?: string | null;
  shopGstin?: string | null;
  invoiceNumber: string;
  issuedAt: Date;
  isIgst: boolean;
  invoiceStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  customer: {
    name: string;
    phone?: string | null;
    address?: string | null;
    billingAddress?: string | null;
    gstin?: string | null;
  } | null;
  items: Array<{
    productName: string;
    sizeLabel: string;
    sku: string;
    quantity: number;
    returnedQuantity?: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.82, 0.82, 0.82);
const BRAND = rgb(0.28, 0.16, 0.08);

// Column x-positions shared by the table header and every row, so header
// labels and values always line up exactly.
const COL = { item: 50, qty: 400, amount: 545 };

/** Place next to the file once licensed — falls back to bold Helvetica if absent, never throws. */
const BRAND_FONT_PATH = path.join(process.cwd(), 'assets', 'fonts', 'MonumentExtended-Regular.otf');

function rightAlign(page: PDFPage, text: string, rightEdgeX: number, y: number, size: number, font: PDFFont, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightEdgeX - width, y, size, font, color });
}

function centerText(page: PDFPage, text: string, centerX: number, y: number, size: number, font: PDFFont, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

/** Wraps plain text within maxWidth; returns the y position after the last line drawn. */
function drawWrappedText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, maxWidth: number, lineGap = 4): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y, size, font, color: INK });
      y -= size + lineGap;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font, color: INK });
    y -= size + lineGap;
  }
  return y;
}

/** Single-column receipt-style invoice: FROM/BILL TO header, itemized table, totals, footer. */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let brandFont: PDFFont = bold;
  try {
    const brandFontBytes = await readFile(BRAND_FONT_PATH);
    brandFont = await doc.embedFont(brandFontBytes);
  } catch {
    // Font file not present yet — fall back to bold Helvetica, no crash.
  }

  const page = doc.addPage([595, 842]);

  const left = COL.item;
  const right = COL.amount;
  const colWidth = (right - left - 30) / 2;
  const billToX = left + colWidth + 30;

  let y = 842 - 60;

  // ── Wordmark + invoice meta ─────────────────────────────────────────
  page.drawText(data.shopName.toUpperCase(), { x: left, y, size: 22, font: brandFont, color: INK });
  rightAlign(page, `Invoice #${data.invoiceNumber}`, right, y + 6, 9, font, MUTED);
  rightAlign(page, data.issuedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), right, y - 6, 9, font, MUTED);
  y -= 46;

  // ── FROM / BILL TO ───────────────────────────────────────────────────
  const fromTop = y;
  page.drawText('FROM', { x: left, y, size: 9, font: bold, color: INK });
  let fy = y - 20;
  page.drawText(data.shopName, { x: left, y: fy, size: 10.5, font, color: INK });
  fy -= 18;
  if (data.shopAddress) {
    fy = drawWrappedText(page, data.shopAddress, left, fy, 10.5, font, colWidth);
    fy -= 4;
  }
  page.drawText('India', { x: left, y: fy, size: 10.5, font, color: INK });
  fy -= 18;
  if (data.shopGstin) {
    page.drawText(`GSTIN: ${data.shopGstin}`, { x: left, y: fy, size: 9, font, color: MUTED });
    fy -= 14;
  }

  let by = fromTop;
  page.drawText('BILL TO', { x: billToX, y: by, size: 9, font: bold, color: INK });
  by -= 20;
  if (data.customer) {
    page.drawText(data.customer.name, { x: billToX, y: by, size: 10.5, font, color: INK });
    by -= 15;
    if (data.customer.phone) {
      page.drawText(data.customer.phone, { x: billToX, y: by, size: 9, font, color: MUTED });
      by -= 17;
    } else {
      by -= 17;
    }
    const billingText = data.customer.billingAddress ?? data.customer.address;
    if (billingText) {
      by = drawWrappedText(page, billingText, billToX, by, 10.5, font, colWidth);
      by -= 4;
      page.drawText('India', { x: billToX, y: by, size: 10.5, font, color: INK });
      by -= 18;
    }
    if (data.customer.gstin) {
      page.drawText(`GSTIN: ${data.customer.gstin}`, { x: billToX, y: by, size: 9, font, color: MUTED });
      by -= 14;
    }
  } else {
    page.drawText('Walk-in customer', { x: billToX, y: by, size: 10.5, font, color: INK });
  }

  y = Math.min(fy, by) - 20;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 26;

  // ── Items table ──────────────────────────────────────────────────────
  page.drawText('ITEMS', { x: COL.item, y, size: 9, font: bold, color: INK });
  centerText(page, 'QUANTITY', COL.qty, y, 9, bold, INK);
  rightAlign(page, 'AMOUNT', COL.amount, y, 9, bold, INK);
  y -= 22;

  for (const item of data.items) {
    if (y < 140) break; // single-page invoice; long carts split at the order level
    const rowTop = y;
    page.drawText(item.productName, { x: COL.item, y: rowTop, size: 10.5, font: bold, color: INK });
    page.drawText(item.sizeLabel, { x: COL.item, y: rowTop - 15, size: 9.5, font, color: MUTED });

    const fulfilled = item.quantity - (item.returnedQuantity ?? 0);
    centerText(page, `${fulfilled} of ${item.quantity}`, COL.qty, rowTop - 4, 9.5, font, INK);
    rightAlign(page, `Rs. ${item.lineTotal.toFixed(2)}`, COL.amount, rowTop - 4, 10.5, font, INK);

    y -= 40;
  }

  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 26;

  // ── Totals (prices are tax-inclusive — tax is a breakup, never added) ─
  const breakup = computeTaxBreakup(data.total, data.isIgst);
  const taxLabel = data.isIgst
    ? `IGST ${breakup.taxRatePercent}%`
    : `CGST ${(breakup.taxRatePercent / 2).toFixed(0)}% + SGST ${(breakup.taxRatePercent / 2).toFixed(0)}%`;

  page.drawText('Subtotal', { x: COL.item, y, size: 10, font: bold, color: INK });
  rightAlign(page, `Rs. ${data.subtotal.toFixed(2)}`, COL.amount, y, 10, font, INK);
  y -= 20;

  if (data.discountAmount > 0) {
    page.drawText('Discount', { x: COL.item, y, size: 10, font: bold, color: INK });
    rightAlign(page, `- Rs. ${data.discountAmount.toFixed(2)}`, COL.amount, y, 10, font, INK);
    y -= 20;
  }

  page.drawText('Taxes', { x: COL.item, y, size: 10, font: bold, color: INK });
  centerText(page, taxLabel, COL.qty, y, 9.5, font, MUTED);
  rightAlign(page, 'Included', COL.amount, y, 9.5, font, MUTED);
  y -= 34;

  page.drawLine({ start: { x: left, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 1, color: RULE });
  page.drawText('Total', { x: COL.item, y, size: 13, font: bold, color: INK });
  rightAlign(page, `Rs. ${data.total.toFixed(2)}`, COL.amount, y, 13, bold, BRAND);
  y -= 26;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 40;

  // ── Footer ───────────────────────────────────────────────────────────
  const centerX = (left + right) / 2;
  centerText(page, 'Thank you for shopping with us!', centerX, y, 11, font, INK);
  y -= 26;
  centerText(page, data.shopName, centerX, y, 10, font, MUTED);
  y -= 15;
  if (data.shopAddress) {
    centerText(page, `${data.shopAddress}, India`, centerX, y, 9.5, font, MUTED);
    y -= 15;
  }
  if (data.shopEmail) {
    centerText(page, data.shopEmail, centerX, y, 9.5, font, MUTED);
  }

  return doc.save();
}
