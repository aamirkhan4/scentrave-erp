import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { updateCategory } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

const updateSchema = z.object({ name: z.string().min(1).optional(), slug: z.string().min(1).optional(), sortOrder: z.number().optional() });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = updateSchema.parse(await request.json());
    const category = await updateCategory(params.id, body);
    return NextResponse.json({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
