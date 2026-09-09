import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

const createTaskSchema = z.object({
  title: z.string().min(1),
  assigneeId: z.string().uuid(),
  dueAt: z.string().datetime().optional(),
});

/** Follow-up/reorder call reminders for sales staff. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = createTaskSchema.parse(await request.json());
    const task = await prisma.customerTask.create({
      data: {
        customerId: params.id,
        title: body.title,
        assigneeId: body.assigneeId,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateTaskSchema = z.object({ taskId: z.string().uuid(), isDone: z.boolean() });

export async function PATCH(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN', 'SALES_AGENT');
    const body = updateTaskSchema.parse(await request.json());
    const task = await prisma.customerTask.update({ where: { id: body.taskId }, data: { isDone: body.isDone } });
    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}
