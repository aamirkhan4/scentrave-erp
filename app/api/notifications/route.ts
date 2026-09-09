import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await requireUser();
    const recipients = await prisma.notificationRecipient.findMany({
      where: { userId: user.id },
      include: { notification: true },
      orderBy: { notification: { createdAt: 'desc' } },
      take: 50,
    });
    return NextResponse.json({
      notifications: recipients.map((r) => ({
        recipientId: r.id,
        readAt: r.readAt,
        ...r.notification,
      })),
      unreadCount: recipients.filter((r) => !r.readAt).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const markReadSchema = z.object({ recipientId: z.string().uuid() });

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = markReadSchema.parse(await request.json());
    const recipient = await prisma.notificationRecipient.findUniqueOrThrow({ where: { id: body.recipientId } });
    if (recipient.userId !== user.id) {
      return NextResponse.json({ error: 'Not your notification' }, { status: 403 });
    }
    await prisma.notificationRecipient.update({ where: { id: body.recipientId }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
