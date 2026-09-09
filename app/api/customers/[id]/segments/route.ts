import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const assignSchema = z.object({ segmentId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = assignSchema.parse(await request.json());
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { segments: { connect: { id: body.segmentId } } },
      include: { segments: true },
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = assignSchema.parse(await request.json());
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { segments: { disconnect: { id: body.segmentId } } },
      include: { segments: true },
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
