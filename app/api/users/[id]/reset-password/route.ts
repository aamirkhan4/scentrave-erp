import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/storage/supabaseAdmin';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';

const resetSchema = z.object({ newPassword: z.string().min(8, 'Password must be at least 8 characters') });

/**
 * The real answer to "retrieve a user's password": nobody can, ever — not
 * Supabase, not us, since passwords are one-way hashed. This is the actual
 * account-recovery lever an owner has: set a new password on the account
 * without ever seeing (or needing) the old one.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER');
    const body = resetSchema.parse(await request.json());

    const targetUser = await prisma.user.findUniqueOrThrow({ where: { id: params.id } });

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server is not configured with a Supabase service role key' }, { status: 500 });
    }

    const { error } = await admin.auth.admin.updateUserById(targetUser.authId, { password: body.newPassword });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
