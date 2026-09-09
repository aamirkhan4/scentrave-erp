import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { checkoutOrder } from '@/lib/services/order';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const checkoutItemSchema = z.union([
  z.object({
    productVariantId: z.string().uuid(),
    quantity: z.number().int().positive(),
  }),
  z.object({
    custom: z.literal(true),
    label: z.string().trim().min(1).max(200),
    unitPrice: z.number().positive(),
    quantity: z.number().int().positive(),
  }),
]);

const checkoutSchema = z.object({
  customerId: z.string().uuid().optional(),
  guestName: z.string().trim().min(1).max(200).optional(),
  guestPhone: z.string().trim().min(1).max(30).optional(),
  customerState: z.string().min(2),
  items: z.array(checkoutItemSchema).min(1),
  discountCode: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'UPI_DYNAMIC_QR', 'UPI_STATIC_QR', 'CARD', 'BANK_TRANSFER', 'LOYALTY_POINTS', 'OTHER']),
        amount: z.number().positive(),
      }),
    )
    .default([]),
  hold: z.boolean().default(false),
  redeemPoints: z.number().int().positive().optional(),
});

const VALID_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED'] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const statusParam = request.nextUrl.searchParams.get('status');
    const status = VALID_STATUSES.find((s) => s === statusParam);

    // Held bills (DRAFT) are shop-wide — any cashier at the counter should be able to resume one,
    // not just whoever parked it. The cashier-scoped restriction only applies to their own settled sales.
    const scopeToCashier = user.role === 'CASHIER' && status !== 'DRAFT';

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      where: { status, cashierId: scopeToCashier ? user.id : undefined },
      include: { customer: true, invoice: true, items: true },
    });
    return NextResponse.json({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POS checkout: holds a bill (park) or settles it immediately (stock deduction + invoice + payments + loyalty). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const body = checkoutSchema.parse(await request.json());

    const result = await checkoutOrder({
      cashierId: user.id,
      customerId: body.customerId,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      customerState: body.customerState,
      items: body.items,
      discountCode: body.discountCode,
      payments: body.payments,
      hold: body.hold,
      redeemPoints: body.redeemPoints,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
