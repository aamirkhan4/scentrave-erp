import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/storage/supabaseAdmin';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Creates a new staff login: a real Supabase Auth account (pre-confirmed,
 * so there's no repeat of the "unconfirmed email" issue from manually
 * created accounts) plus the app-level User row, linked by authId.
 * Only OWNER can create another OWNER — everyone else is fair game for
 * OWNER or ADMIN to onboard.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole('OWNER', 'ADMIN');
    const body = createUserSchema.parse(await request.json());

    if (body.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only an Owner can create another Owner account' }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server is not configured with a Supabase service role key' }, { status: 500 });
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: authError?.message ?? 'Failed to create auth account' }, { status: 400 });
    }

    try {
      const user = await prisma.user.create({
        data: { authId: authUser.user.id, name: body.name, email: body.email, phone: body.phone, role: body.role },
      });
      return NextResponse.json({ user }, { status: 201 });
    } catch (dbError) {
      // Roll back the auth account so a failed DB insert doesn't leave an orphaned login with no app-level record.
      await admin.auth.admin.deleteUser(authUser.user.id);
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
