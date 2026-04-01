import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { consumePasswordResetToken } from "@/lib/tokens";
import { sendPasswordChangedEmail } from "@/lib/services/notification";
import bcrypt from "bcryptjs";
import { z } from "zod";

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, {
    maxRequests: 5,
    windowMs: 60_000,
    keyPrefix: "reset-password",
  });
  if (rateLimited) return rateLimited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const { token, password } = parsed.data;

  // Consume token (one-time use — deleted regardless of outcome)
  const email = await consumePasswordResetToken(token);

  if (!email) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  try {
    const owner = await prisma.owner.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!owner) {
      // Edge case: account deleted between token creation and use
      return NextResponse.json(
        { error: "This reset link is no longer valid. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.owner.update({
      where: { id: owner.id },
      data: { passwordHash },
    });

    // Notify user that password was changed (fire-and-forget)
    sendPasswordChangedEmail(email).catch((err) => {
      console.error("[reset-password] Password changed email failed:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] Internal error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
