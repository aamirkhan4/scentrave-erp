import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { setActiveFormula } from '@/lib/services/catalog';
import { handleApiError } from '@/lib/api/errors';

const schema = z.object({
  lines: z.array(z.object({ rawMaterialId: z.string().uuid(), quantityPerMl: z.number().positive() })).min(1),
  notes: z.string().optional(),
});

/** Publishes a new formula version for this product (append-only — the previous version is deactivated, not deleted). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const body = schema.parse(await request.json());
    const formula = await setActiveFormula({ productId: params.id, lines: body.lines, createdById: user.id, notes: body.notes });
    return NextResponse.json({ formula }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
