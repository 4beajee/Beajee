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

export async function resetPasswordWithToken(
  rawToken: string,
  passwordHash: string
): Promise<string | null> {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.$queryRaw<Array<{ identifier: string }>>`
      DELETE FROM verification_tokens
      WHERE token = ${hashedToken}
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
