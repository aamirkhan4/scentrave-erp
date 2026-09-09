import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { updateSubcategory } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  isRawMaterialView: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = updateSchema.parse(await request.json());
    const subcategory = await updateSubcategory(params.id, body);
    return NextResponse.json({ subcategory });
  } catch (error) {
    return handleApiError(error);
  }
}
