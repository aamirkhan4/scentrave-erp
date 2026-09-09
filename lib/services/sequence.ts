import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** "2026-08-23" -> "25-26" (Indian FY: April–March) */
export function currentFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const fyStart = month >= 4 ? year : year - 1;
  const startYY = fyStart % 100;
  const endYY = (fyStart + 1) % 100;
  return `${String(startYY).padStart(2, '0')}-${String(endYY).padStart(2, '0')}`;
}

/**
 * Atomically hands out the next number for a given kind+FY (e.g. "invoice-25-26").
 * Must be called inside the same transaction as the record that consumes it,
 * so a rolled-back transaction doesn't burn a number.
 */
export async function nextSequenceNumber(tx: Tx, kind: 'invoice' | 'batch' | 'order' | 'mix', financialYear: string): Promise<number> {
  const key = `${kind}-${financialYear}`;
  const sequence = await tx.sequence.upsert({
    where: { key },
    create: { key, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });
  return sequence.lastSequence;
}

export function formatSequencedNumber(prefix: string, financialYear: string, sequence: number): string {
  return `${prefix}/${financialYear}/${String(sequence).padStart(5, '0')}`;
}
