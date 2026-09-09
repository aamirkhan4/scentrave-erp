import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/session';
import { InsufficientStockError } from '@/lib/services/stockMovement';
import { InvalidDiscountError } from '@/lib/services/discount';
import { EmptyCartError } from '@/lib/services/order';
import { OverpaymentError } from '@/lib/services/payment';
import { InvalidReturnError } from '@/lib/services/returns';
import { InsufficientLoyaltyPointsError } from '@/lib/services/loyalty';

/** Shared error->HTTP mapping so every route responds consistently. */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthenticatedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof InsufficientStockError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof InvalidDiscountError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof EmptyCartError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof OverpaymentError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof InvalidReturnError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof InsufficientLoyaltyPointsError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', issues: error.issues }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
