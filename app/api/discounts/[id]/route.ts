import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

/** An unused code is removed outright; one that's already been applied to orders is deactivated instead, since past orders reference it. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const discount = await prisma.discount.findUniqueOrThrow({ where: { id: params.id } });

    if (discount.usageCount === 0) {
      await prisma.discount.delete({ where: { id: params.id } });
      return NextResponse.json({ deleted: true });
    }

    await prisma.discount.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ deleted: false, deactivated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
