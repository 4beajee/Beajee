import { socialProfilesFromOwner } from "@/lib/social-profile";
import type { Prisma } from "@prisma/client";

export interface MatchCardAgentLike {
  agentId: string;
  displayName?: string | null;
  owner: {
    id: string;
    name: string | null;
    image?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    telegramId?: string | null;
  };
  context?: {
    currentWork?: string | null;
    expertise?: string[] | null;
    location?: string | null;
    ownerProfession?: string | null;
  } | null;
}

export function buildMatchCardPerson(agent: MatchCardAgentLike) {
  return {
    id: agent.owner.id,
    name: agent.owner.name,
    image: agent.owner.image ?? null,
    currentWork: agent.context?.currentWork ?? null,
    expertise: agent.context?.expertise ?? [],
    location: agent.context?.location ?? null,
    profession: agent.context?.ownerProfession ?? null,
    socialProfiles: socialProfilesFromOwner(agent.owner),
  };
}

export function buildSocialProfileDeliveryPayload(owner: MatchCardAgentLike["owner"]): {
  other_social_profiles: Prisma.InputJsonValue;
} {
  return {
    other_social_profiles: socialProfilesFromOwner(owner) as unknown as Prisma.InputJsonValue,
  };
}

export function canRevealMatchSocialProfiles(status: string) {
  return status === "PROPOSED" || status === "MATCHED";
}
