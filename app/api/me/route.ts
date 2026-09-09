import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

/** Lightweight "who am I" endpoint so client components can identify the current user (e.g. to scope a Realtime subscription). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});

/** Self-service profile edit — anyone can update their own name/phone. Role and active status are Owner-only, via /api/users/[id]. */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireUser();
    const body = updateSchema.parse(await request.json());
    const user = await prisma.user.update({ where: { id: currentUser.id }, data: body });
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
