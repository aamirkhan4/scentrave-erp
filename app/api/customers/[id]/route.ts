import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getCustomerProfile } from '@/lib/services/crm';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const profile = await getCustomerProfile(params.id);
    return NextResponse.json({ customer: profile });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  state: z.string().min(2).optional(),
  gstin: z.string().optional(),
  address: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  priceListId: z.string().uuid().nullable().optional(),
  preferredCategory: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = updateSchema.parse(await request.json());
    const customer = await prisma.customer.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Only removable when they have no order history — a customer tied to a real sale is a financial record, not just a contact. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const orderCount = await prisma.order.count({ where: { customerId: params.id } });
    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Can't delete — this customer has ${orderCount} order(s) on file. Remove is blocked to keep sales history intact.` },
        { status: 409 },
      );
    }
    await prisma.customer.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
