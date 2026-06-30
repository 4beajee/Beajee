import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  redactTelegramSecrets,
  TelegramAuthError,
  verifyUnifiedToken,
} from "@/lib/telegram/auth";
import { setOwnerSchedulingUrl } from "@/lib/services/owner-scheduling";
import { SocialProfilePatchSchema, socialProfilesFromOwner } from "@/lib/social-profile";
import { setOwnerSocialProfiles } from "@/lib/services/owner-social-profile";
import { z, ZodError } from "zod";

const TelegramProfilePatchSchema = z.object({
  schedulingUrl: z.string().optional(),
  socialProfiles: SocialProfilePatchSchema.optional(),
}).refine(
  (value) => value.schedulingUrl !== undefined || value.socialProfiles !== undefined,
  "No profile fields supplied"
);

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getBearerToken(request));
    const owner = await prisma.owner.findUnique({
      where: { id: verified.ownerId },
      select: {
        id: true,
        name: true,
        onboarded: true,
        schedulingUrl: true,
        linkedinUrl: true,
        twitterUrl: true,
      },
    });

    if (!owner) {
      return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      owner: { ...owner, socialProfiles: socialProfilesFromOwner(owner) },
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[telegram-profile] GET failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getBearerToken(request));
    const body = TelegramProfilePatchSchema.parse(await request.json());
    if (body.schedulingUrl !== undefined) {
      await setOwnerSchedulingUrl({
        ownerId: verified.ownerId,
        schedulingUrl: body.schedulingUrl,
      });
    }
    const owner = await prisma.owner.findUniqueOrThrow({
      where: { id: verified.ownerId },
      select: { schedulingUrl: true, linkedinUrl: true, twitterUrl: true },
    });
    const socialProfiles = body.socialProfiles !== undefined
      ? await setOwnerSocialProfiles({
          ownerId: verified.ownerId,
          patch: body.socialProfiles,
          source: "telegram",
        })
      : socialProfilesFromOwner(owner);

    return NextResponse.json({
      ok: true,
      schedulingUrl: owner.schedulingUrl,
      socialProfiles,
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes("Cal.com")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? "Invalid profile" },
        { status: 400 }
      );
    }
    if (error instanceof Error && /LinkedIn|Twitter\/X|Social profile/.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[telegram-profile] PATCH failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 });
  }
}
