import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createSubcategory } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  isRawMaterialView: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const subcategory = await createSubcategory({ categoryId: params.id, ...body });
    return NextResponse.json({ subcategory }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
