import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ChangePasswordSchema } from "@/types/settings";
import { sendPasswordChangedEmail } from "@/lib/services/notification";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await rateLimit(request, {
      maxRequests: 5,
      windowMs: 60_000,
      keyPrefix: "change-password",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let validated;
    try {
      validated = ChangePasswordSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        const firstError = e.issues[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: firstError }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const owner = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      select: { passwordHash: true, email: true },
    });

    if (!owner?.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google sign-in. Password change is not available." },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(validated.currentPassword, owner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(validated.newPassword, 12);
    await prisma.owner.update({
      where: { id: auth.ownerId },
      data: { passwordHash: newHash, sessionVersion: { increment: 1 } },
    });

    // Notify — fire-and-forget
    sendPasswordChangedEmail(owner.email).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/password] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
