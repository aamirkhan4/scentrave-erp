import type { LoyaltyTier, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** ₹ value of one loyalty point when redeemed. Default: 100 pts = ₹50. Configurable — adjust to your actual program. */
export const LOYALTY_REDEMPTION_RUPEES_PER_POINT = 0.5;

/** Lifetime-spend thresholds (₹) for tier auto-assignment. Configurable — adjust to your actual program. */
const TIER_THRESHOLDS: Array<{ tier: LoyaltyTier; minLifetimeValue: number }> = [
  { tier: 'PLATINUM', minLifetimeValue: 75_000 },
  { tier: 'GOLD', minLifetimeValue: 25_000 },
  { tier: 'SILVER', minLifetimeValue: 5_000 },
];

export function computeLoyaltyTier(lifetimeValue: number): LoyaltyTier | null {
  return TIER_THRESHOLDS.find((t) => lifetimeValue >= t.minLifetimeValue)?.tier ?? null;
}

/**
 * Recomputes and updates a customer's tier from their lifetime spend
 * (confirmed/partially-returned orders). Tiers only ever move up — a
 * customer keeps their highest-earned tier even if a later purchase is
 * small or returned, matching typical retail loyalty program behavior.
 */
export async function updateLoyaltyTierIfEarned(tx: Tx, customerId: string): Promise<void> {
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
  const totals = await tx.order.aggregate({
    where: { customerId, status: { in: ['CONFIRMED', 'PARTIALLY_RETURNED'] } },
    _sum: { total: true },
  });
  const lifetimeValue = Number(totals._sum.total ?? 0);
  const earnedTier = computeLoyaltyTier(lifetimeValue);

  const tierRank: Record<LoyaltyTier, number> = { SILVER: 1, GOLD: 2, PLATINUM: 3 };
  const currentRank = customer.loyaltyTier ? tierRank[customer.loyaltyTier] : 0;
  const earnedRank = earnedTier ? tierRank[earnedTier] : 0;

  if (earnedTier && earnedRank > currentRank) {
    await tx.customer.update({ where: { id: customerId }, data: { loyaltyTier: earnedTier } });
  }
}

export class InsufficientLoyaltyPointsError extends Error {
  constructor(available: number, requested: number) {
    super(`Insufficient loyalty points: has ${available}, tried to redeem ${requested}`);
    this.name = 'InsufficientLoyaltyPointsError';
  }
}

/** Redeems points for their rupee value, logging a REDEEMED ledger entry. Returns the rupee value to apply as a payment leg. */
export async function redeemLoyaltyPoints(tx: Tx, input: { customerId: string; points: number; orderId: string }): Promise<number> {
  if (input.points <= 0) throw new Error('points must be positive');

  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
  if (customer.loyaltyPoints < input.points) {
    throw new InsufficientLoyaltyPointsError(customer.loyaltyPoints, input.points);
  }

  await tx.loyaltyLedgerEntry.create({
    data: {
      customerId: input.customerId,
      type: 'REDEEMED',
      points: -input.points,
      orderId: input.orderId,
      note: `Redeemed ${input.points} points`,
    },
  });
  await tx.customer.update({ where: { id: input.customerId }, data: { loyaltyPoints: { decrement: input.points } } });

  return input.points * LOYALTY_REDEMPTION_RUPEES_PER_POINT;
}
