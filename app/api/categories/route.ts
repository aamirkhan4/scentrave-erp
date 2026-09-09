import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { listCategoriesWithSubcategories, createCategory } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const categories = await listCategoriesWithSubcategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({ name: z.string().min(1), slug: z.string().min(1), sortOrder: z.number().optional() });

export async function POST(request: NextRequest) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const body = createSchema.parse(await request.json());
    const category = await createCategory(body);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
