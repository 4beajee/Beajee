import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { resetPasswordWithToken } from "@/lib/tokens";
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
  const rateLimited = await rateLimit(request, {
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

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const email = await resetPasswordWithToken(token, passwordHash);
    if (!email) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

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
