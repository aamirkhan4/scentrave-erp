import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

const updateSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT']).optional(),
  isActive: z.boolean().optional(),
});

/** Role changes and activation/deactivation are Owner-only — higher-risk than day-to-day catalog edits. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole('OWNER');
    const body = updateSchema.parse(await request.json());

    if (params.id === actor.id && (body.isActive === false || (body.role && body.role !== 'OWNER'))) {
      return NextResponse.json({ error: "You can't deactivate or demote your own account" }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
