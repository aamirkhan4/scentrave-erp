import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/pdf/invoice';
import { getSupabaseAdminClient } from '@/lib/storage/supabaseAdmin';
import { buildWhatsAppShareLink } from '@/lib/notify/whatsapp';
import { getShopSettings } from '@/lib/services/shopSettings';
import { resolveInvoiceCustomer } from '@/lib/services/invoice';

const INVOICE_BUCKET = 'invoices';

/**
 * Generates the invoice PDF and uploads it to Supabase Storage (public
 * bucket) so it has a URL a customer can open without being logged into the
 * app. Falls back to the app's own (auth-gated) PDF route when Storage
 * isn't configured — usable for internal sharing, not for customers, so the
 * caller should surface that distinction if it matters.
 */
export async function getOrCreateInvoicePdfUrl(invoiceId: string): Promise<{ url: string; publiclyAccessible: boolean }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      order: {
        include: { customer: true, items: { include: { productVariant: { include: { product: true } } } } },
      },
    },
  });

  if (invoice.pdfUrl) {
    return { url: invoice.pdfUrl, publiclyAccessible: true };
  }

  const admin = getSupabaseAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!admin) {
    if (!appUrl) throw new Error('Neither Supabase Storage nor NEXT_PUBLIC_APP_URL is configured — cannot build an invoice link');
    return { url: `${appUrl}/api/invoices/${invoiceId}/pdf`, publiclyAccessible: false };
  }

  const shopSettings = await getShopSettings();

  const pdfBytes = await generateInvoicePdf({
    shopName: shopSettings.shopName,
    shopAddress: shopSettings.address,
    shopEmail: shopSettings.email,
    shopGstin: shopSettings.gstin,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    isIgst: invoice.order.isIgst,
    invoiceStatus: invoice.status,
    customer: resolveInvoiceCustomer(invoice.order),
    items: invoice.order.items.map((item) => ({
      productName: item.customLabel ?? item.productVariant.product.name,
      sizeLabel: item.customLabel ? '' : item.productVariant.sizeLabel,
      sku: item.productVariant.sku,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      unitPrice: Number(item.unitPrice),
      discountAmount: Number(item.discountAmount),
      taxAmount: Number(item.taxAmount),
      lineTotal: Number(item.lineTotal),
    })),
    subtotal: Number(invoice.order.subtotal),
    discountAmount: Number(invoice.order.discountAmount),
    taxAmount: Number(invoice.order.taxAmount),
    total: Number(invoice.order.total),
  });

  const path = `${invoice.financialYear}/${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
  const { error } = await admin.storage.from(INVOICE_BUCKET).upload(path, Buffer.from(pdfBytes), {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload invoice PDF: ${error.message}`);

  const { data: publicUrlData } = admin.storage.from(INVOICE_BUCKET).getPublicUrl(path);
  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: publicUrlData.publicUrl } });

  return { url: publicUrlData.publicUrl, publiclyAccessible: true };
}

export async function buildInvoiceWhatsAppShare(invoiceId: string): Promise<{ pdfUrl: string; whatsappLink: string | null }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { include: { customer: true } } },
  });
  const { url } = await getOrCreateInvoicePdfUrl(invoiceId);

  const customerPhone = invoice.order.customer?.phone ?? invoice.order.guestPhone;
  if (!customerPhone) return { pdfUrl: url, whatsappLink: null };

  const customerName = invoice.order.customer?.name ?? invoice.order.guestName ?? '';
  const message = `Hi ${customerName}, here's your Scentrave invoice ${invoice.invoiceNumber} for ₹${Number(invoice.order.total).toFixed(2)}: ${url}`;
  return { pdfUrl: url, whatsappLink: buildWhatsAppShareLink(customerPhone, message) };
}
