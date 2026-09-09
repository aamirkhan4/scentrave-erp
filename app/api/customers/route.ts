import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';

    const customers = await prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { phone: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    return handleApiError(error);
  }
}

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  state: z.string().min(2),
});

/** Quick walk-in customer creation from the billing counter. */
export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const body = createCustomerSchema.parse(await request.json());
    const customer = await prisma.customer.create({ data: body });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
