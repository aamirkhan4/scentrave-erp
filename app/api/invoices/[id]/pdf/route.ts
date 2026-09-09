import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { generateInvoicePdf } from '@/lib/pdf/invoice';
import { handleApiError } from '@/lib/api/errors';
import { getShopSettings } from '@/lib/services/shopSettings';
import { resolveInvoiceCustomer } from '@/lib/services/invoice';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { productVariant: { include: { product: true } } } },
          },
        },
      },
    });

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

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
