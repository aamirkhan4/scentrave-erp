import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Several services (checkout, production batches, stock movements) run
    // multiple sequential queries inside one interactive transaction. The
    // 5s Prisma default is too tight against a distant DB region — raised
    // here so it applies to every $transaction() call without threading
    // options through each call site individually.
    transactionOptions: { timeout: 20_000, maxWait: 10_000 },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
