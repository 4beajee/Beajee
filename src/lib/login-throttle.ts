import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const FAILURE_WINDOW_MS = 60 * 60 * 1000;
const BACKOFF_START = 5;
const MAX_BACKOFF_MS = 15 * 60 * 1000;

export function loginThrottleKey(email: string, ip: string) {
  const salt = process.env.LOGIN_RATE_LIMIT_SALT ?? process.env.NEXTAUTH_SECRET ?? "local";
  return crypto.createHmac("sha256", salt).update(`${email}:${ip}`).digest("hex");
}

export async function isLoginBlocked(key: string, now = new Date()) {
  const attempt = await prisma.loginAttempt.findUnique({ where: { key } });
  return Boolean(attempt && attempt.lockedUntil > now);
}

export async function recordLoginFailure(
  key: string,
  ownerId: string | null,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`login:${key}`}, 0))
    `;
    const existing = await tx.loginAttempt.findUnique({ where: { key } });
    const withinWindow = existing && existing.updatedAt.getTime() > now.getTime() - FAILURE_WINDOW_MS;
    const failures = withinWindow ? existing.failures + 1 : 1;
    const exponent = Math.max(0, failures - BACKOFF_START);
    const delayMs = failures < BACKOFF_START
      ? 0
      : Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** exponent);
    return tx.loginAttempt.upsert({
      where: { key },
      create: {
        key,
        ownerId,
        failures,
        lockedUntil: new Date(now.getTime() + delayMs),
      },
      update: {
        ownerId,
        failures,
        lockedUntil: new Date(now.getTime() + delayMs),
      },
    });
  });
}

export async function clearLoginFailures(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}
