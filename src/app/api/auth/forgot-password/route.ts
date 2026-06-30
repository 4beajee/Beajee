import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/services/notification";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email";

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  // Strict rate limit: 3 requests per 60 seconds per IP
  const rateLimited = await rateLimit(request, {
    maxRequests: 3,
    windowMs: 60_000,
    keyPrefix: "forgot-password",
  });
  if (rateLimited) return rateLimited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const { email } = parsed.data;
  const trimmedEmail = normalizeEmail(email);

  // Always return the same response regardless of whether the email exists.
  // This prevents user enumeration attacks.
  const genericResponse = NextResponse.json({ ok: true });

  try {
    const owner = await prisma.owner.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    // Only send email if:
    // 1. Account exists
    // 2. Account has a password (not Google-only)
    if (owner?.passwordHash) {
      // Use the DB-stored email as token identifier for exact-match consistency
      const rawToken = await createPasswordResetToken(owner.email);
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      // Fire-and-forget — don't let email failures affect response time
      sendPasswordResetEmail(owner.email, resetUrl).catch((err) => {
        console.error("[forgot-password] Email send failed:", err);
      });
    }
  } catch (err) {
    // Log internally but don't expose to user
    console.error("[forgot-password] Internal error:", err);
  }

  return genericResponse;
}
