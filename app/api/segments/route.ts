import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const segments = await prisma.customerSegment.findMany({
      include: { _count: { select: { customers: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ segments });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({ name: z.string().min(1), description: z.string().optional() });

export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = createSchema.parse(await request.json());
    const segment = await prisma.customerSegment.create({ data: body });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
