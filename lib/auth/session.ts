import type { Role, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer';

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  constructor(required: Role[]) {
    super(`Requires one of roles: ${required.join(', ')}`);
    this.name = 'ForbiddenError';
  }
}

/** Resolves the app-level User (with role) for the currently signed-in Supabase session. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return prisma.user.findUnique({ where: { authId: authUser.id } });
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) throw new UnauthenticatedError();
  return user;
}

/** Throws ForbiddenError if the current user's role isn't in `allowed`. Use in every route/action that touches cost, formulas, or price lists. */
export async function requireRole(...allowed: Role[]): Promise<User> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new ForbiddenError(allowed);
  return user;
}
