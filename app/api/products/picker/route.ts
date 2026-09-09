import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

/** Lightweight {id, name} list for picker dropdowns (e.g. Buy-X-Get-Y discount scoping) — no variants/formulas joined, so it's safe to leave unpaginated. */
export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ products });
  } catch (error) {
    return handleApiError(error);
  }
}
