import crypto from "crypto";
import { prisma } from "@/lib/db";

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a cryptographically secure password reset token.
 * Stores a SHA-256 hash in the database (so a DB leak doesn't compromise tokens).
 * Returns the raw token to be sent via email.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Delete any existing reset tokens for this email (one active token at a time)
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  });

  return rawToken;
}

/**
 * Validate a password reset token.
 * Returns the email (identifier) if valid, or null if invalid/expired/missing.
 * Deletes the token after successful validation (one-time use).
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record) return null;

  // Always delete the token (consumed or expired)
  await prisma.verificationToken.delete({
    where: { token: hashedToken },
  });

  // Check expiry
  if (record.expires < new Date()) return null;

  return record.identifier;
}
