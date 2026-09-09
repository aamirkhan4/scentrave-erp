import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getShopSettings, updateShopSettings } from '@/lib/services/shopSettings';
import { handleApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    await requireRole('OWNER', 'ADMIN');
    const settings = await getShopSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

// The GET response round-trips through the edit form as-is, and unset
// optional fields come back as `null` (not absent) — so every optional
// field here has to accept null too, not just undefined, or saving the
// form back unchanged fails validation on every field nobody touched.
const updateSchema = z.object({
  shopName: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional(),
  gstHomeState: z.string().min(2).optional(),
  invoicePrefix: z.string().min(1).optional(),
  upiVpa: z.string().nullable().optional(),
  upiPayeeName: z.string().nullable().optional(),
});

/** Business identity is Owner-only to edit — it's what shows on every invoice and drives the tax calculation. */
export async function PATCH(request: NextRequest) {
  try {
    await requireRole('OWNER');
    const body = updateSchema.parse(await request.json());
    const settings = await updateShopSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
