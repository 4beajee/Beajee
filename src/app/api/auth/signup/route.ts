import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendEmailVerificationEmail } from "@/lib/services/notification";

const SignupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const rateLimited = await rateLimit(request, { maxRequests: 5, windowMs: 60_000, keyPrefix: "signup" });
  if (rateLimited) return rateLimited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { password, name } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const existing = await prisma.owner.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, passwordHash: true },
  });

  // A generic response prevents account enumeration. An existing unverified
  // password account may receive a fresh verification email; verified accounts
  // are never modified by an anonymous signup request.
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.owner.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        onboarded: false,
      },
    });
  }

  if (!existing || (!existing.emailVerified && existing.passwordHash)) {
    const token = await createEmailVerificationToken(email);
    const baseUrl = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
    const verificationUrl = new URL("/api/auth/verify-email", baseUrl);
    verificationUrl.searchParams.set("token", token);
    sendEmailVerificationEmail(email, verificationUrl.toString()).catch((error) => {
      console.error("[signup] Failed to send verification email:", error);
    });
  }

  return NextResponse.json(
    { ok: true, message: "If this email can use password sign-in, a verification link has been sent." },
    { status: 202 }
  );
}
