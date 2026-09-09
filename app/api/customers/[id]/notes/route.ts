import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const createNoteSchema = z.object({ body: z.string().min(1) });

/** Calls, complaints, feedback — appended to the customer's timeline. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT');
    const body = createNoteSchema.parse(await request.json());
    const note = await prisma.customerNote.create({
      data: { customerId: params.id, authorId: user.id, body: body.body },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
