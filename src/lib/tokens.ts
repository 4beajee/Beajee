import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { VerificationTokenPurpose } from "@prisma/client";

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

async function createOneTimeToken(
  email: string,
  purpose: VerificationTokenPurpose,
  expiryMs: number
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + expiryMs);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: email, purpose } }),
    prisma.verificationToken.create({
      data: { identifier: email, token: hashedToken, expires, purpose },
    }),
  ]);

  return rawToken;
}

/**
 * Generate a cryptographically secure password reset token.
 * Stores a SHA-256 hash in the database (so a DB leak doesn't compromise tokens).
 * Returns the raw token to be sent via email.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  return createOneTimeToken(email, "PASSWORD_RESET", RESET_TOKEN_EXPIRY_MS);
}

export async function createEmailVerificationToken(email: string): Promise<string> {
  return createOneTimeToken(
    email,
    "EMAIL_VERIFICATION",
    EMAIL_VERIFICATION_TOKEN_EXPIRY_MS
  );
}

export async function resetPasswordWithToken(
  rawToken: string,
  passwordHash: string
): Promise<string | null> {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.$queryRaw<Array<{ identifier: string }>>`
      DELETE FROM verification_tokens
      WHERE token = ${hashedToken}
        AND purpose = 'PASSWORD_RESET'
        AND expires > NOW()
      RETURNING identifier
    `;
    const email = consumed[0]?.identifier;
    if (!email) return null;
    const owner = await tx.owner.findUnique({ where: { email }, select: { id: true } });
    if (!owner) return null;
    await tx.owner.update({
      where: { id: owner.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    return email;
  });
}

export async function verifyEmailWithToken(rawToken: string): Promise<string | null> {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.$queryRaw<Array<{ identifier: string }>>`
      DELETE FROM verification_tokens
      WHERE token = ${hashedToken}
        AND purpose = 'EMAIL_VERIFICATION'
        AND expires > NOW()
      RETURNING identifier
    `;
    const email = consumed[0]?.identifier;
    if (!email) return null;

    const owner = await tx.owner.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!owner) return null;

    await tx.owner.update({
      where: { id: owner.id },
      data: { emailVerified: new Date() },
    });
    return email;
  });
}
