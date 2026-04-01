import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Retry a database operation with exponential backoff.
 * Use for critical writes that fail due to transient Supabase connection drops.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500 } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const isTransient =
        error instanceof Error &&
        (error.message.includes("Can't reach database server") ||
          error.message.includes("Connection refused") ||
          error.message.includes("Connection timed out") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("server closed the connection"));
      if (!isTransient || attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
