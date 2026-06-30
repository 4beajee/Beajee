import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics-tracking";
import {
  normalizeSocialProfilePatch,
  socialProfilesFromOwner,
  type SocialProfilePatch,
} from "@/lib/social-profile";

export type SocialProfileUpdateSource = "settings" | "telegram" | "mcp";

export async function setOwnerSocialProfiles(args: {
  ownerId: string;
  patch: SocialProfilePatch;
  source: SocialProfileUpdateSource;
}) {
  const data = normalizeSocialProfilePatch(args.patch);
  const owner = await prisma.owner.update({
    where: { id: args.ownerId },
    data,
    select: {
      id: true,
      linkedinUrl: true,
      twitterUrl: true,
    },
  });

  const profiles = socialProfilesFromOwner(owner);
  if (profiles.linkedin || profiles.twitter) {
    await prisma.inboxEvent.updateMany({
      where: {
        ownerId: owner.id,
        type: "PROFILE_COMPLETION_SUGGESTION",
        dismissedAt: null,
      },
      data: { dismissedAt: new Date() },
    });
  }
  const updatedProviders = [
    ...(data.linkedinUrl !== undefined ? ["linkedin"] : []),
    ...(data.twitterUrl !== undefined ? ["twitter"] : []),
  ];
  await recordAnalyticsEvent({
    type: "SOCIAL_PROFILE_SAVED",
    ownerId: owner.id,
    metadata: {
      source: args.source,
      providers: updatedProviders,
      populated_count: Number(!!profiles.linkedin) + Number(!!profiles.twitter),
    },
  }).catch(() => undefined);

  return profiles;
}
