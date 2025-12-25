import { PrismaClient } from '@prisma/client';

// Use a looser type here because generated Prisma client types may not be available
// in the analysis environment. Casting to `any` prevents TS errors like
// "Property 'user' does not exist on type 'PrismaClient'" during compilation.
const globalForPrisma = global as unknown as { prisma?: any };

export const prisma: any =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: ['error', 'warn'],
  }) as any);

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
