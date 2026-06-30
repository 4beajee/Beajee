import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function bucketKey(prefix: string, ip: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.NEXTAUTH_SECRET ?? "local";
  return crypto.createHmac("sha256", salt).update(`${prefix}:${ip}`).digest("hex");
}

export async function rateLimit(
  request: NextRequest,
  { maxRequests, windowMs, keyPrefix }: { maxRequests: number; windowMs: number; keyPrefix: string }
): Promise<NextResponse | null> {
  const key = bucketKey(keyPrefix, clientIp(request));
  const now = new Date();

  try {
    const bucket = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`rate:${key}`}, 0))
      `;
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });
      const expired = !existing || existing.resetAt <= now;
      return tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
        update: expired
          ? { count: 1, resetAt: new Date(now.getTime() + windowMs) }
          : { count: { increment: 1 } },
      });
    });

    if (bucket.count <= maxRequests) return null;
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  } catch (error) {
    console.error("[rate-limit] Durable limiter unavailable:", error);
    return NextResponse.json({ error: "Request protection unavailable" }, { status: 503 });
  }
}
